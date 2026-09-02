import MarkdownIt from "markdown-it";
import type StateCore from "markdown-it/lib/rules_core/state_core.mjs";
import DOMPurify from "dompurify";

// Fenced code blocks with this language are rendered as mermaid diagrams
// (markdown-it emits them as <pre><code class="language-mermaid">).
export const MERMAID_LANG = "mermaid";

// GitHub-style task list items: "- [ ] todo" / "- [x] done" become list
// items with a disabled checkbox, as in Obsidian's reading view.
function taskLists(md: MarkdownIt): void {
    md.core.ruler.after("inline", "a3-task-lists", (state: StateCore) => {
        const tokens = state.tokens;
        for (let i = 2; i < tokens.length; i++) {
            const inline = tokens[i];
            if (
                inline.type !== "inline" ||
                tokens[i - 1].type !== "paragraph_open" ||
                tokens[i - 2].type !== "list_item_open" ||
                !inline.children?.length
            ) {
                continue;
            }
            const text = inline.children[0];
            const match = /^\[([ xX])\] /.exec(text.content);
            if (text.type !== "text" || !match) continue;
            text.content = text.content.slice(match[0].length);
            const checkbox = new state.Token("html_inline", "", 0);
            checkbox.content = `<input class="task-list-item-checkbox" type="checkbox" disabled${
                match[1] === " " ? "" : " checked"
            }> `;
            inline.children.unshift(checkbox);
            tokens[i - 2].attrJoin("class", "task-list-item");
        }
    });
}

const md = new MarkdownIt({ html: true }).use(taskLists);

export function markdownToHtml(markdown: string): string {
    return md.render(markdown);
}

export interface RenderMarkdownOptions {
    // Rewrite image sources (e.g. resolve paths relative to the document
    // into URLs the host can display). Absolute URLs are passed through.
    resolveImageSrc?: (src: string) => string;
}

// Render markdown into `el` as sanitized DOM: raw HTML in the markdown is
// kept (as Obsidian does) minus scripts and event handlers.
export function renderMarkdownInto(
    el: HTMLElement,
    markdown: string,
    options: RenderMarkdownOptions = {}
): void {
    const fragment = DOMPurify.sanitize(markdownToHtml(markdown), {
        RETURN_DOM_FRAGMENT: true,
    });
    if (options.resolveImageSrc) {
        for (const img of Array.from(fragment.querySelectorAll("img"))) {
            const src = img.getAttribute("src");
            if (src && !/^[a-z][a-z0-9+.-]*:/i.test(src)) {
                img.setAttribute("src", options.resolveImageSrc(src));
            }
        }
    }
    el.appendChild(fragment);
}
