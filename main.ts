import mermaid from "mermaid";
import {
    MarkdownRenderer,
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


%%{init: {'themeVariables': {'fontSize': '1em'}, 'flowchart': {'nodeSpacing': 20, 'rankSpacing': 20, 'padding': 0, 'diagramPadding': 0}}}%%

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

// Swap the view type of a leaf while keeping it on the same file.
async function setLeafViewType(leaf: WorkspaceLeaf, type: string): Promise<void> {
    await leaf.setViewState({
        type,
        state: leaf.getViewState().state,
        active: true,
    });
}

// Obsidian's own mermaid pipeline bakes text measurements into the SVG at
// render time and caches the result by source text, so a font-size change
// never reaches it. Instead, mermaid blocks are hidden from Obsidian (by
// renaming their code-fence language) and rendered by the plugin's own
// bundled mermaid, re-initialized with the scaled font size on each render.
const A3_MERMAID_LANG = "a3-mermaid";

function hideMermaidFromObsidian(markdown: string): string {
    return markdown.replace(/```mermaid[ \t]*$/gm, "```" + A3_MERMAID_LANG);
}

const MIN_FONT_SIZE_PT = 7;
const MAX_FONT_SIZE_PT = 13;
// The plugin's original, pre-adjustable page size, used as the anchor for
// scaling mermaid's label font size so it re-lays-out diagrams (node boxes
// included) to match, instead of just visually zooming the rendered SVG.
const BASE_FONT_SIZE_PT = 10;
const BASE_MERMAID_FONT_SIZE_PX = 10;

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
        // Persist the new size in the workspace layout (see getState)
        this.app.workspace.requestSaveLayout();
        // A full re-render (not just restyling the page) so mermaid
        // recomputes its diagrams at the new, proportionally scaled size.
        void this.render();
    }

    // The chosen font size is part of the view state, so it survives
    // reopening the note and app restarts (stored in the workspace layout).
    getState(): Record<string, unknown> {
        const state = super.getState() as Record<string, unknown>;
        state.fontSizePt = this.fontSizePt;
        return state;
    }

    async setState(state: unknown, result: ViewStateResult): Promise<void> {
        const fontSizePt = (state as { fontSizePt?: unknown } | null)
            ?.fontSizePt;
        let changed = false;
        if (typeof fontSizePt === "number") {
            const clamped = Math.min(
                MAX_FONT_SIZE_PT,
                Math.max(MIN_FONT_SIZE_PT, Math.round(fontSizePt))
            );
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
        const seqBefore = this.renderSeq;
        await super.setState(state, result);
        if (changed && this.page && this.renderSeq === seqBefore) {
            void this.render();
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

    // Export the rendered page as a standalone HTML file (mermaid SVGs are
    // inline, so it is self-contained) and open it in the default browser,
    // where the user can print it on A3 landscape.
    private async printA3(): Promise<void> {
        const page = this.page;
        if (!page) return;
        if (!Platform.isDesktopApp) {
            new Notice("Printing is only available on desktop.");
            return;
        }
        const req = (window as unknown as { require: (id: string) => unknown })
            .require;
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
        // Print at true size: drop the inline fit zoom copied from the pane
        clone.style.removeProperty("zoom");
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
        const os = req("os") as typeof import("node:os");
        const fspath = req("path") as typeof import("node:path");
        const fs = req("fs") as typeof import("node:fs");
        const electron = req("electron") as {
            shell: { openPath: (path: string) => Promise<string> };
        };
        const safeName = title.replace(/[^\wÀ-ɏ -]+/g, "_");
        const outPath = fspath.join(os.tmpdir(), `${safeName} (A3 print).html`);
        fs.writeFileSync(outPath, html, "utf8");
        await electron.shell.openPath(outPath);
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

    private async render(retried = false): Promise<void> {
        // At app startup the view can be asked to render before the
        // workspace is laid out; mermaid would then measure its labels in
        // a zero-sized pane and lay diagrams out wrong. Defer until ready
        // (the callback fires immediately if the layout already is).
        if (!this.app.workspace.layoutReady) {
            this.app.workspace.onLayoutReady(() => void this.render(retried));
            return;
        }
        const seq = ++this.renderSeq;
        this.contentEl.empty();
        const page = this.contentEl.createDiv({ cls: "a3-page" });
        this.page = page;
        // Mermaid measures its HTML labels with getBoundingClientRect(),
        // which is scaled by an ancestor's CSS zoom: node boxes would come
        // out too small for their text. Render at zoom 1, fit afterwards.
        // (The fresh page div has no inline zoom yet, so it renders at 1.)
        page.setCssProps({ "font-size": `${this.fontSizePt}pt` });
        await MarkdownRenderer.render(
            this.app,
            hideMermaidFromObsidian(this.data),
            page,
            this.file?.path ?? "",
            this
        );
        if (seq !== this.renderSeq) return; // superseded by a newer render
        await this.renderMermaidDiagrams(page, seq);
        if (seq !== this.renderSeq) return;
        this.fitZoom();
        // Some code-block post-processors can complete shortly after
        // render() resolves; fit once more when they have.
        window.setTimeout(() => {
            if (seq !== this.renderSeq) return;
            this.fitZoom();
            // Self-heal: if a mermaid label overflows its box, the fonts
            // or stylesheets changed under the initial measurement (e.g.
            // during app startup); one full re-render fixes the layout.
            if (!retried && this.mermaidLabelsOverflow()) {
                void this.render(true);
            }
        }, 400);
    }

    private mermaidLabelsOverflow(): boolean {
        const page = this.page;
        if (!page) return false;
        return Array.from(
            page.querySelectorAll<HTMLElement>(".mermaid foreignObject div")
        ).some((el) => el.scrollWidth > el.clientWidth + 1);
    }


    // Render the a3-mermaid code blocks with the plugin's bundled mermaid,
    // re-initialized each time so node boxes are laid out around text
    // measured at the page's current font size.
    private async renderMermaidDiagrams(
        page: HTMLElement,
        seq: number
    ): Promise<void> {
        const blocks = Array.from(
            page.querySelectorAll<HTMLElement>(
                `pre > code.language-${A3_MERMAID_LANG}`
            )
        );
        if (blocks.length === 0) return;
        const fontSizePx =
            (BASE_MERMAID_FONT_SIZE_PX * this.fontSizePt) / BASE_FONT_SIZE_PT;
        mermaid.initialize({
            startOnLoad: false,
            fontSize: fontSizePx,
            themeVariables: { fontSize: `${fontSizePx}px` },
        });
        for (const [i, code] of blocks.entries()) {
            const source = code.textContent ?? "";
            const pre = code.parentElement as HTMLElement;
            const container = createDiv({ cls: "mermaid" });
            pre.replaceWith(container);
            try {
                const { svg, bindFunctions } = await mermaid.render(
                    `a3-mermaid-${seq}-${i}`,
                    source,
                    container
                );
                if (seq !== this.renderSeq) return;
                // Parse the SVG string into a detached document and adopt
                // only the <svg> element, rather than assigning innerHTML
                // on the live DOM. The lenient text/html parser is used
                // because htmlLabels inside foreignObject need not be
                // well-formed XML.
                const parsed = new DOMParser().parseFromString(
                    svg,
                    "text/html"
                );
                const svgEl = parsed.body.querySelector("svg");
                container.empty();
                if (svgEl) {
                    container.appendChild(document.importNode(svgEl, true));
                    bindFunctions?.(container);
                }
            } catch (e) {
                console.error("A3: mermaid render failed", e);
                container.setText(String(e));
            }
        }
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
        page.setCssProps({ zoom: String(zoom) });
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
