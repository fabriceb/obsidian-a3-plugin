import mermaid from "mermaid";
import { mermaidFontSizePx } from "./font-size";
import { MERMAID_LANG, renderMarkdownInto, RenderMarkdownOptions } from "./markdown";

export type A3RendererOptions = RenderMarkdownOptions;

// Renders markdown as an A3 page (div.a3-page) inside a container element
// and keeps the page scaled to fit it. Mermaid blocks are rendered by the
// bundled mermaid, re-initialized with a font size scaled to the page's on
// every render, so diagrams are laid out around text at the chosen size
// (a CSS zoom alone would leave node boxes sized for the default text).
export class A3Renderer {
    private page: HTMLElement | null = null;
    private renderSeq = 0;

    constructor(
        private readonly container: HTMLElement,
        private readonly options: A3RendererOptions = {}
    ) {}

    getPage(): HTMLElement | null {
        return this.page;
    }

    // Replace the container's content with a fresh page. A render that is
    // superseded by a newer one stops at the next await.
    render(markdown: string, fontSizePt: number): Promise<void> {
        return this.renderInternal(markdown, fontSizePt, false);
    }

    private async renderInternal(
        markdown: string,
        fontSizePt: number,
        retried: boolean
    ): Promise<void> {
        const seq = ++this.renderSeq;
        this.container.replaceChildren();
        const page = document.createElement("div");
        page.className = "a3-page";
        this.container.appendChild(page);
        this.page = page;
        // Mermaid measures its HTML labels with getBoundingClientRect(),
        // which is scaled by an ancestor's CSS zoom: node boxes would come
        // out too small for their text. Render at zoom 1, fit afterwards.
        // (The fresh page div has no inline zoom yet, so it renders at 1.)
        page.style.setProperty("--a3-font-size", `${fontSizePt}pt`);
        renderMarkdownInto(page, markdown, this.options);
        await this.renderMermaidDiagrams(page, seq, fontSizePt);
        if (seq !== this.renderSeq) return;
        this.fitZoom();
        // Fonts and stylesheets can settle shortly after the render; fit
        // once more when they have.
        window.setTimeout(() => {
            if (seq !== this.renderSeq) return;
            this.fitZoom();
            // Self-heal: if a mermaid label overflows its box, the fonts
            // or stylesheets changed under the initial measurement (e.g.
            // during app startup); one full re-render fixes the layout.
            if (!retried && this.mermaidLabelsOverflow()) {
                void this.renderInternal(markdown, fontSizePt, true);
            }
        }, 400);
    }

    // Drop the page and cancel any in-flight render.
    clear(): void {
        this.renderSeq++;
        this.container.replaceChildren();
        this.page = null;
    }

    mermaidLabelsOverflow(): boolean {
        const page = this.page;
        if (!page) return false;
        // getElementsByTagName rather than a "foreignObject div" selector:
        // camelCase SVG type selectors don't work everywhere (notably not
        // in jsdom, where the unit tests run); tag name lookup does.
        return Array.from(page.querySelectorAll(".mermaid")).some((m) =>
            Array.from(m.getElementsByTagName("foreignObject")).some((fo) =>
                Array.from(fo.getElementsByTagName("div")).some(
                    (el) => el.scrollWidth > el.clientWidth + 1
                )
            )
        );
    }

    private async renderMermaidDiagrams(
        page: HTMLElement,
        seq: number,
        fontSizePt: number
    ): Promise<void> {
        const blocks = Array.from(
            page.querySelectorAll<HTMLElement>(
                `pre > code.language-${MERMAID_LANG}`
            )
        );
        if (blocks.length === 0) return;
        const fontSizePx = mermaidFontSizePx(fontSizePt);
        mermaid.initialize({
            startOnLoad: false,
            fontSize: fontSizePx,
            themeVariables: { fontSize: `${fontSizePx}px` },
        });
        for (const [i, code] of blocks.entries()) {
            // markdown-it keeps the fence's trailing newline; mermaid does not need it
            const source = (code.textContent ?? "").replace(/\n$/, "");
            const pre = code.parentElement as HTMLElement;
            const container = document.createElement("div");
            container.className = "mermaid";
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
                container.replaceChildren();
                if (svgEl) {
                    container.appendChild(document.importNode(svgEl, true));
                    bindFunctions?.(container);
                }
            } catch (e) {
                console.error("A3: mermaid render failed", e);
                container.textContent = String(e);
            }
        }
    }

    // Scale the page so it fits entirely inside the container.
    fitZoom(): void {
        const page = this.page;
        if (!page) return;
        const container = this.container;
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
        page.style.setProperty("zoom", String(zoom));
    }

    // The page's markup at true size (inline fit-zoom removed), for the
    // print export. Mermaid SVGs are inline, so it is self-contained.
    getPrintMarkup(): string | null {
        const page = this.page;
        if (!page) return null;
        const clone = page.cloneNode(true) as HTMLElement;
        clone.style.removeProperty("zoom");
        return clone.outerHTML;
    }
}
