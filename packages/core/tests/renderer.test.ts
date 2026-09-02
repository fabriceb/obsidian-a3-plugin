import { afterEach, describe, expect, it, vi } from "vitest";
import { initialize, render as mermaidRender } from "./mocks/mermaid";
import { A3Renderer } from "../src/renderer";
import { defineSize, mermaidLabel } from "./helpers";

const DIAGRAM = "```mermaid\ngraph TD;A-->B\n```";

function makeRenderer(): { container: HTMLElement; renderer: A3Renderer } {
    const container = document.createElement("div");
    document.body.appendChild(container);
    return { container, renderer: new A3Renderer(container) };
}

afterEach(() => {
    vi.useRealTimers();
    document.body.replaceChildren();
});

describe("render", () => {
    it("creates a fresh .a3-page with the font size as a CSS custom property", async () => {
        const { container, renderer } = makeRenderer();
        await renderer.render("# Hello", 13);
        const page = container.querySelector<HTMLElement>(".a3-page");
        expect(page).not.toBeNull();
        expect(page?.style.getPropertyValue("--a3-font-size")).toBe("13pt");
        expect(page?.querySelector("h1")?.textContent).toBe("Hello");
        expect(renderer.getPage()).toBe(page);
        await renderer.render("# Again", 9);
        expect(container.querySelectorAll(".a3-page")).toHaveLength(1);
        expect(container.querySelector("h1")?.textContent).toBe("Again");
    });

    it("abandons a render superseded by a newer one", async () => {
        const { container, renderer } = makeRenderer();
        let release: () => void = () => {};
        mermaidRender.mockImplementationOnce(
            () =>
                new Promise((resolve) => {
                    release = () =>
                        resolve({ svg: "<svg></svg>", bindFunctions: undefined });
                })
        );
        const first = renderer.render(DIAGRAM, 13); // stalls inside mermaid
        const second = renderer.render("# Second", 13);
        release();
        await Promise.all([first, second]);
        expect(container.querySelectorAll(".a3-page")).toHaveLength(1);
        expect(container.querySelector("h1")?.textContent).toBe("Second");
        expect(container.querySelector("svg")).toBeNull();
    });

    it("clear drops the page and cancels an in-flight render", async () => {
        const { container, renderer } = makeRenderer();
        let release: () => void = () => {};
        mermaidRender.mockImplementationOnce(
            () =>
                new Promise((resolve) => {
                    release = () =>
                        resolve({ svg: "<svg></svg>", bindFunctions: undefined });
                })
        );
        const pending = renderer.render(DIAGRAM, 13);
        renderer.clear();
        release();
        await pending;
        expect(container.childElementCount).toBe(0);
        expect(renderer.getPage()).toBeNull();
    });
});

describe("mermaid rendering", () => {
    it("renders mermaid code blocks with the bundled mermaid", async () => {
        const { container, renderer } = makeRenderer();
        await renderer.render(DIAGRAM, 13);
        const diagram = container.querySelector(".mermaid");
        expect(diagram).not.toBeNull();
        expect(diagram?.querySelector("svg")).not.toBeNull();
        expect(container.querySelector("pre")).toBeNull();
        expect(mermaidRender).toHaveBeenCalledTimes(1);
        expect(mermaidRender.mock.calls[0][1]).toBe("graph TD;A-->B");
    });

    it("re-initializes mermaid with the font size scaled to the page size", async () => {
        const { renderer } = makeRenderer();
        await renderer.render(DIAGRAM, 13); // 13pt -> 13px (10px base at 10pt)
        expect(initialize).toHaveBeenLastCalledWith(
            expect.objectContaining({
                startOnLoad: false,
                fontSize: 13,
                themeVariables: { fontSize: "13px" },
            })
        );
        await renderer.render(DIAGRAM, 7);
        expect(initialize).toHaveBeenLastCalledWith(
            expect.objectContaining({
                fontSize: 7,
                themeVariables: { fontSize: "7px" },
            })
        );
    });

    it("does not touch mermaid when the document has no diagrams", async () => {
        const { renderer } = makeRenderer();
        await renderer.render("# Just text\n\n```js\nlet x = 1;\n```", 13);
        expect(initialize).not.toHaveBeenCalled();
        expect(mermaidRender).not.toHaveBeenCalled();
    });

    it("gives each diagram a unique id per render generation", async () => {
        const { renderer } = makeRenderer();
        await renderer.render("```mermaid\nA\n```\n\n```mermaid\nB\n```", 13);
        const ids = mermaidRender.mock.calls.map((c) => c[0] as string);
        expect(new Set(ids).size).toBe(2);
        for (const id of ids) expect(id).toMatch(/^a3-mermaid-\d+-\d+$/);
    });

    it("shows the error in place when a diagram fails to render", async () => {
        mermaidRender.mockRejectedValueOnce(new Error("bad syntax"));
        vi.spyOn(console, "error").mockImplementation(() => {});
        const { container, renderer } = makeRenderer();
        await renderer.render("```mermaid\nnot a diagram\n```", 13);
        expect(container.querySelector(".mermaid")?.textContent).toContain(
            "bad syntax"
        );
    });
});

describe("self-healing after mis-measured labels", () => {
    it("re-renders once when a mermaid label overflows its box", async () => {
        vi.useFakeTimers();
        const { container, renderer } = makeRenderer();
        await renderer.render(DIAGRAM, 13);
        expect(mermaidRender).toHaveBeenCalledTimes(1);
        const label = mermaidLabel(container);
        expect(label).not.toBeNull();
        defineSize(label!, { scrollWidth: 100, clientWidth: 75 });
        await vi.advanceTimersByTimeAsync(400);
        expect(mermaidRender).toHaveBeenCalledTimes(2);
        // The re-render's own 400ms check must not loop even if labels
        // still overflow.
        const label2 = mermaidLabel(container);
        defineSize(label2!, { scrollWidth: 100, clientWidth: 75 });
        await vi.advanceTimersByTimeAsync(400);
        expect(mermaidRender).toHaveBeenCalledTimes(2);
    });

    it("does not re-render when labels fit", async () => {
        vi.useFakeTimers();
        const { container, renderer } = makeRenderer();
        await renderer.render(DIAGRAM, 13);
        defineSize(mermaidLabel(container)!, { scrollWidth: 74, clientWidth: 75 });
        await vi.advanceTimersByTimeAsync(400);
        expect(mermaidRender).toHaveBeenCalledTimes(1);
    });

    it("tolerates a 1px measurement wobble", async () => {
        const { container, renderer } = makeRenderer();
        await renderer.render(DIAGRAM, 13);
        const label = mermaidLabel(container)!;
        defineSize(label, { scrollWidth: 76, clientWidth: 75 });
        expect(renderer.mermaidLabelsOverflow()).toBe(false);
        defineSize(label, { scrollWidth: 77, clientWidth: 75 });
        expect(renderer.mermaidLabelsOverflow()).toBe(true);
    });
});

describe("fitZoom", () => {
    async function fitted(
        containerSize: { clientWidth: number; clientHeight: number },
        pageSize: { offsetWidth: number; offsetHeight: number }
    ): Promise<string> {
        const { container, renderer } = makeRenderer();
        container.style.padding = "0px";
        await renderer.render("# x", 13);
        defineSize(container, containerSize);
        defineSize(renderer.getPage()!, pageSize);
        renderer.getPage()!.style.removeProperty("zoom");
        renderer.fitZoom();
        return renderer.getPage()!.style.getPropertyValue("zoom");
    }

    it("scales the page down to fit the pane", async () => {
        expect(
            await fitted(
                { clientWidth: 800, clientHeight: 600 },
                { offsetWidth: 1600, offsetHeight: 1000 }
            )
        ).toBe("0.5");
    });

    it("never zooms above 1 when the page already fits", async () => {
        expect(
            await fitted(
                { clientWidth: 4000, clientHeight: 3000 },
                { offsetWidth: 1600, offsetHeight: 1000 }
            )
        ).toBe("1");
    });

    it("is limited by the tighter dimension", async () => {
        expect(
            await fitted(
                { clientWidth: 1600, clientHeight: 250 },
                { offsetWidth: 1600, offsetHeight: 1000 }
            )
        ).toBe("0.25");
    });

    it("does nothing while the pane has no size yet", async () => {
        expect(
            await fitted(
                { clientWidth: 0, clientHeight: 0 },
                { offsetWidth: 1600, offsetHeight: 1000 }
            )
        ).toBe("");
    });
});

describe("getPrintMarkup", () => {
    it("returns the page at true size, without the fit zoom", async () => {
        const { renderer } = makeRenderer();
        await renderer.render("# Title", 13);
        renderer.getPage()!.style.setProperty("zoom", "0.5");
        const markup = renderer.getPrintMarkup()!;
        expect(markup).toContain('class="a3-page"');
        expect(markup).toContain("<h1>Title</h1>");
        expect(markup).not.toMatch(/zoom/);
        // The live page keeps its zoom.
        expect(renderer.getPage()!.style.getPropertyValue("zoom")).toBe("0.5");
    });

    it("is null before anything rendered", () => {
        expect(makeRenderer().renderer.getPrintMarkup()).toBeNull();
    });
});
