import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import * as vscode from "vscode";
import {
    DEFAULT_FONT_SIZE_PT,
    clampFontSizePt,
} from "@a3/core/font-size";
import { buildPrintHtml, printExportFileName } from "@a3/core/print";
import { A3_TEMPLATE } from "@a3/core/template";
import type {
    HostToWebviewMessage,
    PanelState,
    WebviewToHostMessage,
} from "./messages";

const VIEW_TYPE = "a3.preview";
const RENDER_DEBOUNCE_MS = 300;

function fontSizeKey(uri: vscode.Uri): string {
    return `a3.fontSizePt:${uri.toString()}`;
}

// One A3 panel per markdown document, re-rendered as the document changes.
class A3Panel {
    private static readonly panels = new Map<string, A3Panel>();
    static active: A3Panel | undefined;

    static show(
        context: vscode.ExtensionContext,
        uri: vscode.Uri,
        column: vscode.ViewColumn
    ): A3Panel {
        const existing = A3Panel.panels.get(uri.toString());
        if (existing) {
            existing.panel.reveal(column);
            return existing;
        }
        const panel = vscode.window.createWebviewPanel(
            VIEW_TYPE,
            A3Panel.title(uri),
            column,
            A3Panel.webviewOptions(context, uri)
        );
        return new A3Panel(context, panel, uri, undefined);
    }

    static restore(
        context: vscode.ExtensionContext,
        panel: vscode.WebviewPanel,
        state: PanelState | undefined
    ): void {
        if (!state?.uri) {
            panel.dispose();
            return;
        }
        const uri = vscode.Uri.parse(state.uri);
        panel.webview.options = A3Panel.webviewOptions(context, uri);
        new A3Panel(context, panel, uri, state.fontSizePt);
    }

    private static title(uri: vscode.Uri): string {
        return `A3: ${path.basename(uri.path, ".md")}`;
    }

    private static webviewOptions(
        context: vscode.ExtensionContext,
        uri: vscode.Uri
    ): vscode.WebviewOptions & vscode.WebviewPanelOptions {
        const roots = [vscode.Uri.joinPath(context.extensionUri, "dist")];
        if (uri.scheme === "file") {
            roots.push(vscode.Uri.file(path.dirname(uri.fsPath)));
        }
        for (const folder of vscode.workspace.workspaceFolders ?? []) {
            roots.push(folder.uri);
        }
        return {
            enableScripts: true,
            localResourceRoots: roots,
            retainContextWhenHidden: true,
        };
    }

    private fontSizePt: number;
    private ready = false;
    private renderTimer: NodeJS.Timeout | undefined;
    private nextRequestId = 1;
    private readonly pendingPrint = new Map<
        number,
        (markup: string | null) => void
    >();
    private readonly disposables: vscode.Disposable[] = [];

    private constructor(
        private readonly context: vscode.ExtensionContext,
        readonly panel: vscode.WebviewPanel,
        readonly uri: vscode.Uri,
        restoredFontSizePt: number | undefined
    ) {
        A3Panel.panels.set(uri.toString(), this);
        this.fontSizePt = clampFontSizePt(
            restoredFontSizePt ??
                context.workspaceState.get<number>(
                    fontSizeKey(uri),
                    DEFAULT_FONT_SIZE_PT
                )
        );
        panel.webview.html = this.html();
        this.disposables.push(
            panel.webview.onDidReceiveMessage((m: WebviewToHostMessage) =>
                this.onMessage(m)
            ),
            panel.onDidChangeViewState(() => {
                if (panel.active) A3Panel.active = this;
            }),
            vscode.workspace.onDidChangeTextDocument((e) => {
                if (e.document.uri.toString() === uri.toString()) {
                    this.scheduleRender();
                }
            }),
            panel.onDidDispose(() => this.dispose())
        );
        if (panel.active) A3Panel.active = this;
    }

    private dispose(): void {
        A3Panel.panels.delete(this.uri.toString());
        if (A3Panel.active === this) A3Panel.active = undefined;
        if (this.renderTimer) clearTimeout(this.renderTimer);
        for (const d of this.disposables) d.dispose();
    }

    private post(message: HostToWebviewMessage): void {
        void this.panel.webview.postMessage(message);
    }

    private onMessage(message: WebviewToHostMessage): void {
        switch (message.type) {
            case "ready":
                this.ready = true;
                void this.render();
                break;
            case "printMarkup": {
                const resolve = this.pendingPrint.get(message.requestId);
                this.pendingPrint.delete(message.requestId);
                resolve?.(message.markup);
                break;
            }
        }
    }

    private scheduleRender(): void {
        if (this.renderTimer) clearTimeout(this.renderTimer);
        this.renderTimer = setTimeout(() => void this.render(), RENDER_DEBOUNCE_MS);
    }

    private async render(): Promise<void> {
        if (!this.ready) return;
        const document = await vscode.workspace.openTextDocument(this.uri);
        const folder =
            this.uri.scheme === "file"
                ? vscode.Uri.file(path.dirname(this.uri.fsPath) + path.sep)
                : undefined;
        this.post({
            type: "render",
            uri: this.uri.toString(),
            markdown: document.getText(),
            fontSizePt: this.fontSizePt,
            baseUri: folder ? this.panel.webview.asWebviewUri(folder).toString() : "",
        });
    }

    setFontSizePt(pt: number): void {
        const clamped = clampFontSizePt(pt);
        if (clamped === this.fontSizePt) return;
        this.fontSizePt = clamped;
        void this.context.workspaceState.update(fontSizeKey(this.uri), clamped);
        void this.render();
    }

    getFontSizePt(): number {
        return this.fontSizePt;
    }

    // Ask the webview for the page at true size (the DOM lives there).
    requestPrintMarkup(): Promise<string | null> {
        const requestId = this.nextRequestId++;
        return new Promise((resolve) => {
            const timer = setTimeout(() => {
                this.pendingPrint.delete(requestId);
                resolve(null);
            }, 5000);
            this.pendingPrint.set(requestId, (markup) => {
                clearTimeout(timer);
                resolve(markup);
            });
            this.post({ type: "requestPrintMarkup", requestId });
        });
    }

    private html(): string {
        const webview = this.panel.webview;
        const dist = vscode.Uri.joinPath(this.context.extensionUri, "dist");
        const asUri = (file: string) =>
            webview.asWebviewUri(vscode.Uri.joinPath(dist, file)).toString();
        const nonce = Array.from({ length: 32 }, () =>
            Math.floor(Math.random() * 36).toString(36)
        ).join("");
        // Mermaid emits inline <style> in its SVGs, hence 'unsafe-inline'
        // for styles; scripts are limited to the bundled webview script.
        const csp = [
            "default-src 'none'",
            `img-src ${webview.cspSource} https: data:`,
            `style-src ${webview.cspSource} 'unsafe-inline'`,
            `font-src ${webview.cspSource}`,
            `script-src 'nonce-${nonce}'`,
        ].join("; ");
        return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="${csp}">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="stylesheet" href="${asUri("a3.css")}">
<link rel="stylesheet" href="${asUri("webview.css")}">
<title>${A3Panel.title(this.uri)}</title>
</head>
<body>
<div id="a3-root"></div>
<script nonce="${nonce}" src="${asUri("webview.js")}"></script>
</body>
</html>`;
    }
}

async function openPreview(
    context: vscode.ExtensionContext,
    resource?: vscode.Uri
): Promise<void> {
    const uri = resource ?? vscode.window.activeTextEditor?.document.uri;
    if (!uri) {
        void vscode.window.showInformationMessage(
            "Open a markdown file to show it as an A3."
        );
        return;
    }
    A3Panel.show(context, uri, vscode.ViewColumn.Beside);
}

async function createNew(context: vscode.ExtensionContext): Promise<void> {
    const folder = vscode.workspace.workspaceFolders?.[0]?.uri;
    let document: vscode.TextDocument;
    if (folder) {
        // Like Obsidian's "Create new A3": a numbered "Untitled A3.md" in
        // the workspace root.
        let target = vscode.Uri.joinPath(folder, "Untitled A3.md");
        for (let i = 1; await exists(target); i++) {
            target = vscode.Uri.joinPath(folder, `Untitled A3 ${i}.md`);
        }
        await vscode.workspace.fs.writeFile(
            target,
            new TextEncoder().encode(A3_TEMPLATE)
        );
        document = await vscode.workspace.openTextDocument(target);
    } else {
        document = await vscode.workspace.openTextDocument({
            language: "markdown",
            content: A3_TEMPLATE,
        });
    }
    await vscode.window.showTextDocument(document, vscode.ViewColumn.One);
    A3Panel.show(context, document.uri, vscode.ViewColumn.Beside);
}

async function exists(uri: vscode.Uri): Promise<boolean> {
    try {
        await vscode.workspace.fs.stat(uri);
        return true;
    } catch {
        return false;
    }
}

// Export the rendered page as a standalone HTML file and open it in the
// default browser, where the user can print it on A3 landscape.
async function printA3(context: vscode.ExtensionContext): Promise<void> {
    const panel = A3Panel.active;
    if (!panel) return;
    const pageMarkup = await panel.requestPrintMarkup();
    if (pageMarkup === null) {
        void vscode.window.showErrorMessage(
            "A3: nothing rendered yet to print."
        );
        return;
    }
    try {
        const cssPath = vscode.Uri.joinPath(context.extensionUri, "dist", "a3.css");
        const css = await fs.readFile(cssPath.fsPath, "utf8");
        const title = path.basename(panel.uri.path, ".md");
        const html = buildPrintHtml({ title, pageMarkup, css });
        const outPath = path.join(os.tmpdir(), printExportFileName(title));
        await fs.writeFile(outPath, html, "utf8");
        const opened = await vscode.env.openExternal(vscode.Uri.file(outPath));
        if (!opened) throw new Error("openExternal returned false");
    } catch (e) {
        console.error("A3: could not open the print export", e);
        void vscode.window.showErrorMessage(
            "A3: could not open the print export in the browser."
        );
    }
}

export function activate(context: vscode.ExtensionContext): void {
    context.subscriptions.push(
        vscode.commands.registerCommand("a3.openPreview", (resource?: vscode.Uri) =>
            openPreview(context, resource)
        ),
        vscode.commands.registerCommand("a3.createNew", () => createNew(context)),
        vscode.commands.registerCommand("a3.print", () => printA3(context)),
        vscode.commands.registerCommand("a3.openMarkdown", async () => {
            const panel = A3Panel.active;
            if (!panel) return;
            const document = await vscode.workspace.openTextDocument(panel.uri);
            await vscode.window.showTextDocument(document, vscode.ViewColumn.Beside);
        }),
        vscode.commands.registerCommand("a3.increaseFontSize", () => {
            const panel = A3Panel.active;
            panel?.setFontSizePt(panel.getFontSizePt() + 1);
        }),
        vscode.commands.registerCommand("a3.decreaseFontSize", () => {
            const panel = A3Panel.active;
            panel?.setFontSizePt(panel.getFontSizePt() - 1);
        }),
        vscode.window.registerWebviewPanelSerializer(VIEW_TYPE, {
            deserializeWebviewPanel: async (panel, state: PanelState | undefined) => {
                A3Panel.restore(context, panel, state);
            },
        })
    );
}

export function deactivate(): void {}
