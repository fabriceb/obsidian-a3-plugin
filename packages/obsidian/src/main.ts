import {
    MarkdownView,
    Menu,
    Notice,
    Platform,
    Plugin,
    TextFileView,
    TFile,
    ViewStateResult,
    WorkspaceLeaf,
} from "obsidian";
import {
    A3_TEMPLATE,
    A3Renderer,
    DEFAULT_FONT_SIZE_PT,
    MAX_FONT_SIZE_PT,
    MIN_FONT_SIZE_PT,
    buildPrintHtml,
    clampFontSizePt,
    printExportFileName,
} from "@a3/core";

export const A3_VIEW_TYPE = "a3-view";

// Swap the view type of a leaf while keeping it on the same file.
async function setLeafViewType(leaf: WorkspaceLeaf, type: string): Promise<void> {
    await leaf.setViewState({
        type,
        state: leaf.getViewState().state,
        active: true,
    });
}

export class A3View extends TextFileView {
    data = "";
    private renderer: A3Renderer;
    // Counts renders started by this view (see setState).
    private renderCount = 0;
    // Per-view: persisted in the workspace layout (see getState).
    private fontSizePt = DEFAULT_FONT_SIZE_PT;
    private decreaseFontAction: HTMLElement | null = null;
    private increaseFontAction: HTMLElement | null = null;

    constructor(leaf: WorkspaceLeaf, private plugin: A3Plugin) {
        super(leaf);
        this.renderer = new A3Renderer(this.contentEl, {
            resolveImageSrc: (src) => this.resolveImageSrc(src),
        });
    }

    getViewType(): string {
        return A3_VIEW_TYPE;
    }

    getDisplayText(): string {
        return this.file?.basename ?? "A3";
    }

    getIcon(): string {
        return "layout-template";
    }

    async onOpen(): Promise<void> {
        this.addAction("printer", "Open in browser to print", () => {
            void this.printA3();
        });
        this.addAction("pencil", "Open as markdown", () => {
            void setLeafViewType(this.leaf, "markdown");
        });
        this.increaseFontAction = this.addAction(
            "plus",
            "Increase font size",
            () => this.setFontSizePt(this.fontSizePt + 1)
        );
        this.decreaseFontAction = this.addAction(
            "minus",
            "Decrease font size",
            () => this.setFontSizePt(this.fontSizePt - 1)
        );
        this.updateFontSizeActions();
    }

    // Relative image paths in the note resolve like Obsidian's own
    // renderer would: against the vault, from the note's folder.
    private resolveImageSrc(src: string): string {
        const dest = this.app.metadataCache.getFirstLinkpathDest(
            decodeURI(src),
            this.file?.path ?? ""
        );
        return dest ? this.app.vault.getResourcePath(dest) : src;
    }

    private setFontSizePt(pt: number): void {
        const clamped = clampFontSizePt(pt);
        if (clamped === this.fontSizePt) return;
        this.fontSizePt = clamped;
        this.updateFontSizeActions();
        // Persist the new size in the workspace layout (see getState)
        this.app.workspace.requestSaveLayout();
        // A full re-render (not just restyling the page) so mermaid
        // recomputes its diagrams at the new, proportionally scaled size.
        this.render();
    }

    // The chosen font size is part of the view state, so it survives
    // reopening the note and app restarts (stored in the workspace layout).
    getState(): Record<string, unknown> {
        const state = super.getState();
        state.fontSizePt = this.fontSizePt;
        return state;
    }

    async setState(state: unknown, result: ViewStateResult): Promise<void> {
        const fontSizePt = (state as { fontSizePt?: unknown } | null)
            ?.fontSizePt;
        let changed = false;
        if (typeof fontSizePt === "number") {
            const clamped = clampFontSizePt(fontSizePt);
            if (clamped !== this.fontSizePt) {
                this.fontSizePt = clamped;
                this.updateFontSizeActions();
                changed = true;
            }
        }
        // Apply the size before super.setState so the initial render (via
        // setViewData once the file loads) already uses it. Re-render
        // explicitly only if super.setState did not itself start a fresh
        // render (same file, no reload) and a page is showing.
        const countBefore = this.renderCount;
        await super.setState(state, result);
        if (
            changed &&
            this.renderer.getPage() &&
            this.renderCount === countBefore
        ) {
            this.render();
        }
    }

    private updateFontSizeActions(): void {
        this.increaseFontAction?.toggleClass(
            "is-disabled",
            this.fontSizePt >= MAX_FONT_SIZE_PT
        );
        this.decreaseFontAction?.toggleClass(
            "is-disabled",
            this.fontSizePt <= MIN_FONT_SIZE_PT
        );
    }

    // Export the rendered page as a standalone HTML file and open it in
    // the default browser, where the user can print it on A3 landscape.
    private async printA3(): Promise<void> {
        const pageMarkup = this.renderer.getPrintMarkup();
        if (pageMarkup === null) return;
        if (!Platform.isDesktopApp) {
            new Notice("Printing is only available on desktop.");
            return;
        }
        const req = (window as unknown as { require: (id: string) => unknown })
            .require;
        let css = "";
        const dir = this.plugin.manifest.dir;
        if (dir) {
            try {
                css = await this.app.vault.adapter.read(`${dir}/styles.css`);
            } catch (e) {
                console.error("A3: could not read styles.css", e);
            }
        }
        const title = this.file?.basename ?? "A3";
        const html = buildPrintHtml({ title, pageMarkup, css });
        const os = req("os") as { tmpdir: () => string };
        const fspath = req("path") as {
            join: (...parts: string[]) => string;
        };
        const fs = req("fs") as {
            writeFileSync: (path: string, data: string, enc: "utf8") => void;
        };
        const electron = req("electron") as {
            shell: { openPath: (path: string) => Promise<string> };
        };
        const outPath = fspath.join(os.tmpdir(), printExportFileName(title));
        try {
            fs.writeFileSync(outPath, html, "utf8");
            // openPath resolves with an error message (not a rejection)
            // when the file could not be opened
            const openError = await electron.shell.openPath(outPath);
            if (openError) throw new Error(openError);
        } catch (e) {
            console.error("A3: could not open the print export", e);
            new Notice("Could not open the print export in the browser.");
        }
    }

    getViewData(): string {
        return this.data;
    }

    setViewData(data: string, _clear: boolean): void {
        this.data = data;
        this.render();
    }

    clear(): void {
        this.renderer.clear();
    }

    onResize(): void {
        this.renderer.fitZoom();
    }

    private render(): void {
        // At app startup the view can be asked to render before the
        // workspace is laid out; mermaid would then measure its labels in
        // a zero-sized pane and lay diagrams out wrong. Defer until ready
        // (the callback fires immediately if the layout already is).
        if (!this.app.workspace.layoutReady) {
            this.app.workspace.onLayoutReady(() => this.render());
            return;
        }
        this.renderCount++;
        void this.renderer.render(this.data, this.fontSizePt);
    }
}

export default class A3Plugin extends Plugin {
    async onload(): Promise<void> {
        this.registerView(A3_VIEW_TYPE, (leaf) => new A3View(leaf, this));

        this.addCommand({
            id: "toggle-a3-view",
            name: "Toggle A3 view",
            checkCallback: (checking: boolean) => {
                const mdView =
                    this.app.workspace.getActiveViewOfType(MarkdownView);
                const a3View = this.app.workspace.getActiveViewOfType(A3View);
                const leaf = (mdView ?? a3View)?.leaf;
                if (!leaf) return false;
                if (!checking) {
                    void setLeafViewType(
                        leaf,
                        mdView ? A3_VIEW_TYPE : "markdown"
                    );
                }
                return true;
            },
        });

        this.addCommand({
            id: "create-a3",
            name: "Create new A3",
            callback: async () => {
                const folder = this.app.fileManager.getNewFileParent("");
                const prefix = folder.path === "/" ? "" : folder.path + "/";
                let path = `${prefix}Untitled A3.md`;
                for (
                    let i = 1;
                    this.app.vault.getAbstractFileByPath(path);
                    i++
                ) {
                    path = `${prefix}Untitled A3 ${i}.md`;
                }
                const file = await this.app.vault.create(path, A3_TEMPLATE);
                const leaf = this.app.workspace.getLeaf(false);
                await leaf.setViewState({
                    type: A3_VIEW_TYPE,
                    state: { file: file.path },
                    active: true,
                });
            },
        });

        this.registerEvent(
            this.app.workspace.on("file-menu", (menu: Menu, file) => {
                if (!(file instanceof TFile) || file.extension !== "md") {
                    return;
                }
                menu.addItem((item) =>
                    item
                        .setTitle("Open as A3")
                        .setIcon("layout-template")
                        .setSection("open")
                        .onClick(async () => {
                            const leaf = this.app.workspace.getLeaf(false);
                            await leaf.setViewState({
                                type: A3_VIEW_TYPE,
                                state: { file: file.path },
                                active: true,
                            });
                        })
                );
            })
        );

        // "Open as A3" in the three-dot menu of markdown views.
        this.registerEvent(
            this.app.workspace.on("editor-menu", (menu: Menu) => {
                const mdView =
                    this.app.workspace.getActiveViewOfType(MarkdownView);
                if (!mdView) return;
                menu.addItem((item) =>
                    item
                        .setTitle("Open as A3")
                        .setIcon("layout-template")
                        .onClick(() => {
                            void setLeafViewType(mdView.leaf, A3_VIEW_TYPE);
                        })
                );
            })
        );
    }
}
