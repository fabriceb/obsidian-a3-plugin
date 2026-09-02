import { describe, expect, it } from "vitest";
import { markdownToHtml, renderMarkdownInto } from "../src/markdown";

function rendered(markdown: string, resolveImageSrc?: (s: string) => string): HTMLElement {
    const el = document.createElement("div");
    renderMarkdownInto(el, markdown, { resolveImageSrc });
    return el;
}

describe("markdownToHtml", () => {
    it("renders headings, emphasis and tables", () => {
        const html = markdownToHtml(
            "# Title\n\nSome **bold**.\n\n| A | B |\n|---|---|\n| 1 | 2 |\n"
        );
        expect(html).toContain("<h1>Title</h1>");
        expect(html).toContain("<strong>bold</strong>");
        expect(html).toContain("<table>");
        expect(html).toContain("<td>2</td>");
    });

    it("emits mermaid fences as language-mermaid code blocks", () => {
        const html = markdownToHtml("```mermaid\ngraph TD;A-->B\n```");
        expect(html).toContain('<pre><code class="language-mermaid">');
        expect(html).toContain("graph TD;A--&gt;B");
    });

    it("renders task lists as disabled checkboxes", () => {
        const html = markdownToHtml("- [ ] todo\n- [x] done\n- plain");
        expect(html).toContain('<li class="task-list-item"><input class="task-list-item-checkbox" type="checkbox" disabled> todo</li>');
        expect(html).toContain('type="checkbox" disabled checked> done');
        expect(html).toContain("<li>plain</li>");
    });
});

describe("renderMarkdownInto", () => {
    it("appends the rendered content to the element", () => {
        const el = rendered("Hello *there*");
        expect(el.querySelector("p em")?.textContent).toBe("there");
    });

    it("keeps raw HTML but strips scripts and event handlers", () => {
        const el = rendered(
            '<div class="x" onclick="alert(1)">hi</div>\n\n<script>alert(2)</script>\n\n<img src="a.png" onerror="alert(3)">'
        );
        expect(el.querySelector("div.x")?.textContent).toBe("hi");
        expect(el.querySelector("[onclick]")).toBeNull();
        expect(el.querySelector("script")).toBeNull();
        expect(el.querySelector("[onerror]")).toBeNull();
        expect(el.querySelector("img")).not.toBeNull();
    });

    it("resolves relative image sources but leaves absolute URLs alone", () => {
        const el = rendered(
            "![a](img/a.png) ![b](https://example.com/b.png) ![c](data:image/png;base64,AA==)",
            (src) => `resolved:${src}`
        );
        const srcs = Array.from(el.querySelectorAll("img")).map((i) =>
            i.getAttribute("src")
        );
        expect(srcs).toEqual([
            "resolved:img/a.png",
            "https://example.com/b.png",
            "data:image/png;base64,AA==",
        ]);
    });
});
