import {
    MarkdownRenderer,
    MarkdownView,
    Menu,
    Notice,
    Plugin,
    TextFileView,
    TFile,
    WorkspaceLeaf,
} from "obsidian";

export const A3_VIEW_TYPE = "a3-view";

// Kept in sync with a3template.md in the a3-problem-solving-markdown-editor repo.
const A3_TEMPLATE = `# A3 [Problem/Project Name] - Date: [MM/DD/YYYY] - Team: [List of contributors]


## 1. **Background**
Provide context for the problem or opportunity. Why is this important? What is the business impact?

- [Explain the relevance and background of the issue]
- [Describe how it connects to organizational goals]
- [Include any historical context, previous efforts, or key events]

\`\`\`mermaid
---
config:
    xyChart:
        width: 500
        height: 300
        titleFontSize: 12
        xAxis:
            labelFontSize: 8
            titleFontSize: 8
        yAxis:
            labelFontSize: 8
            titleFontSize: 8
    themeVariables:
        xyChart:
            plotColorPalette: "#c3d5ec,#ff0000"


---
xychart-beta
    title "Gap to Standard"
    x-axis [jan, feb, mar, apr, may, jun, jul, aug, sep, oct, nov, dec]
    y-axis "Revenue (in $)" 4000 --> 11000
    bar [8000, 7800, 8500, 9200, 9500, 10500, 10000, 10200, 9200, 8500, 7000, 6000]
    line [9000, 9000, 9000, 9000, 9000, 9000, 9000, 9000, 9000, 9000, 9000, 9000]
\`\`\`

## 2. **Current Condition**
Describe the present situation using data, visuals, or diagrams (e.g., process maps, graphs, charts).

- [Outline the current state of the process, problem, or challenge]
- [Include quantitative and qualitative data]
- [Use visuals to illustrate the problem, if applicable]


## 3. **Target Condition**
Define the desired future state and goals.

- [What does success look like?]
- [Describe measurable objectives]
- [Provide a timeline for achieving improvements]


## 4. **Problem Analysis**
Identify the root causes of the issue using techniques such as the *5 Whys* or Fishbone Diagram.

- [Break down the problem into key factors]
- [Analyze root causes systematically]
- [Ensure the problem statement is clear and specific]

\`\`\`mermaid
graph RL;
    A[Effect / Problem] -->|Cause Category 1| B
    A -->|Cause Category 2| C

    B -->|Sub Cause 1| B1
    B -->|Sub Cause 2| B2
    B -->|Sub Cause 3| B3

    C -->|Sub Cause 1| C1
    C -->|Sub Cause 2| C2
    C -->|Sub Cause 3| C3

\`\`\`


## 5. **Countermeasures**
List proposed solutions to address root causes and move toward the target condition.

| Countermeasure | Expected Impact | Owner | Due Date |
|---------------|----------------|-------|---------|
| [Solution 1]  | [Impact]        | [Owner] | [Date] |
| [Solution 2]  | [Impact]        | [Owner] | [Date] |
| [Solution 3]  | [Impact]        | [Owner] | [Date] |


## 6. **Implementation Plan**
Define actionable steps to execute the countermeasures.

- [List tasks, responsibilities, and deadlines]
- [Identify resources needed]
- [Specify how progress will be tracked and measured]


## 7. **Follow-Up & Adjustments**
Monitor results, assess effectiveness, and determine next steps.

- [Describe how results will be measured]
- [Identify risks or obstacles]
- [Plan for necessary adaptations or next iterations]
`;

// Force a light mermaid theme per diagram. Obsidian initializes mermaid
// with a theme matching the app (dark in dark mode) and newer mermaid bakes
// those colors into inline styles, out of reach of CSS overrides. Injecting
// "theme: neutral" into each block keeps the A3 page paper-like while any
// theme/themeVariables the author wrote themselves still take precedence.
function forceMermaidLightTheme(markdown: string, fontSizePt: number): string {
    // Scale mermaid's own font size (and thus node box sizes, which it
    // computes from measured label text) with the chosen page font size, so
    // diagrams grow/shrink along with the surrounding text.
    const fontSize =
        Math.round(
            ((BASE_MERMAID_FONT_SIZE_PX * fontSizePt) / BASE_FONT_SIZE_PT) *
                100
        ) / 100;
    return markdown.replace(
        /```mermaid[^\n]*\n([\s\S]*?)```/g,
        (match, body: string) => {
            if (/^\s*theme\s*:/m.test(body)) {
                return match; // the author picked a theme, respect it
            }
            // Respect an author-set fontSize even without a custom theme
            const skipFontSize = /^\s*fontSize\s*:/m.test(body);
            const toInsert = ["theme: neutral"];
            if (!skipFontSize) toInsert.push(`fontSize: ${fontSize}`);
            const lines = body.split("\n");
            if (lines[0].trim() === "---") {
                // YAML frontmatter (must stay the first line): put the theme
                // inside the config block
                const end = lines.indexOf("---", 1);
                if (end === -1) return match; // malformed, leave untouched
                const configIdx = lines.findIndex(
                    (l, i) => i > 0 && i < end && /^\s*config\s*:\s*$/.test(l)
                );
                if (configIdx !== -1) {
                    const childIndent =
                        lines[configIdx + 1]?.match(/^\s*/)?.[0] ?? "    ";
                    lines.splice(
                        configIdx + 1,
                        0,
                        ...toInsert.map((l) => childIndent + l)
                    );
                } else {
                    lines.splice(
                        1,
                        0,
                        "config:",
                        ...toInsert.map((l) => "  " + l)
                    );
                }
                return "```mermaid\n" + lines.join("\n") + "```";
            }
            // No frontmatter: an init directive merges with any directives
            // the author wrote later (later ones win on conflicting keys)
            const init: Record<string, unknown> = { theme: "neutral" };
            if (!skipFontSize) init.fontSize = fontSize;
            return (
                "```mermaid\n%%{init: " +
                JSON.stringify(init) +
                "}%%\n" +
                body +
                "```"
            );
        }
    );
}

// Swap the view type of a leaf while keeping it on the same file.
async function setLeafViewType(leaf: WorkspaceLeaf, type: string): Promise<void> {
    await leaf.setViewState({
        type,
        state: leaf.getViewState().state,
        active: true,
    });
}

const MIN_FONT_SIZE_PT = 7;
const MAX_FONT_SIZE_PT = 13;
// The plugin's original, pre-adjustable page size, used as the anchor for
// scaling mermaid's own font size (see forceMermaidLightTheme).
const BASE_FONT_SIZE_PT = 10;
// Mermaid's own default font size (px) at that base page size.
const BASE_MERMAID_FONT_SIZE_PX = 16;

class A3View extends TextFileView {
    data = "";
    private page: HTMLElement | null = null;
    private renderSeq = 0;
    // Per-view: not persisted, resets if the view is closed and reopened.
    private fontSizePt = MAX_FONT_SIZE_PT;
    private decreaseFontAction: HTMLElement | null = null;
    private increaseFontAction: HTMLElement | null = null;

    constructor(leaf: WorkspaceLeaf, private plugin: A3Plugin) {
        super(leaf);
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

    private setFontSizePt(pt: number): void {
        const clamped = Math.min(
            MAX_FONT_SIZE_PT,
            Math.max(MIN_FONT_SIZE_PT, pt)
        );
        if (clamped === this.fontSizePt) return;
        this.fontSizePt = clamped;
        this.updateFontSizeActions();
        // A full re-render (not just restyling the page) so mermaid
        // recomputes its diagrams at the new, proportionally scaled size.
        void this.render();
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

    // Export the rendered page as a standalone HTML file (mermaid SVGs are
    // inline, so it is self-contained) and open it in the default browser,
    // where the user can print it on A3 landscape.
    private async printA3(): Promise<void> {
        const page = this.page;
        if (!page) return;
        const req = (window as unknown as { require?: NodeRequire }).require;
        if (!req) {
            new Notice("Printing is only available on desktop.");
            return;
        }
        let pluginCss = "";
        const dir = this.plugin.manifest.dir;
        if (dir) {
            try {
                pluginCss = await this.app.vault.adapter.read(
                    `${dir}/styles.css`
                );
            } catch (e) {
                console.error("A3: could not read styles.css", e);
            }
        }
        const clone = page.cloneNode(true) as HTMLElement;
        clone.style.zoom = "1"; // print at true size, not the fit zoom
        const title = this.file?.basename ?? "A3";
        const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>${title}</title>
<style>${pluginCss}</style>
<style>
body {
    margin: 0;
    padding: 0;
    background-color: #888888;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
        "Helvetica Neue", sans-serif;
}
@media print {
    body { padding: 0; background-color: #ffffff; }
}
</style>
</head>
<body>
${clone.outerHTML}
</body>
</html>
`;
        const os = req("os");
        const fspath = req("path");
        const fs = req("fs");
        const safeName = title.replace(/[^\wÀ-ɏ -]+/g, "_");
        const outPath = fspath.join(os.tmpdir(), `${safeName} (A3 print).html`);
        fs.writeFileSync(outPath, html, "utf8");
        await req("electron").shell.openPath(outPath);
    }

    getViewData(): string {
        return this.data;
    }

    setViewData(data: string, _clear: boolean): void {
        this.data = data;
        void this.render();
    }

    clear(): void {
        this.renderSeq++;
        this.contentEl.empty();
        this.page = null;
    }

    onResize(): void {
        this.fitZoom();
    }

    private async render(): Promise<void> {
        const seq = ++this.renderSeq;
        this.contentEl.empty();
        const page = this.contentEl.createDiv({ cls: "a3-page" });
        this.page = page;
        // Mermaid measures its HTML labels with getBoundingClientRect(),
        // which is scaled by an ancestor's CSS zoom: node boxes would come
        // out too small for their text. Render at zoom 1, fit afterwards.
        page.style.zoom = "1";
        page.style.fontSize = `${this.fontSizePt}pt`;
        await MarkdownRenderer.render(
            this.app,
            forceMermaidLightTheme(this.data, this.fontSizePt),
            page,
            this.file?.path ?? "",
            this
        );
        if (seq !== this.renderSeq) return; // superseded by a newer render
        this.fitZoom();
        // Some code-block post-processors (mermaid included) can complete
        // shortly after render() resolves; fit once more when they have.
        window.setTimeout(() => {
            if (seq === this.renderSeq) this.fitZoom();
        }, 400);
    }

    // Scale the A3 page so it fits entirely inside the pane.
    private fitZoom(): void {
        const page = this.page;
        if (!page) return;
        const container = this.contentEl;
        const style = window.getComputedStyle(container);
        const availableWidth =
            container.clientWidth -
            parseFloat(style.paddingLeft) -
            parseFloat(style.paddingRight);
        const availableHeight =
            container.clientHeight -
            parseFloat(style.paddingTop) -
            parseFloat(style.paddingBottom);
        if (availableWidth <= 0 || availableHeight <= 0) return;
        // offsetWidth/offsetHeight report the unzoomed layout size, so this
        // stays correct on repeated calls.
        const zoom = Math.min(
            availableWidth / page.offsetWidth,
            availableHeight / page.offsetHeight,
            1
        );
        page.style.zoom = String(zoom);
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
