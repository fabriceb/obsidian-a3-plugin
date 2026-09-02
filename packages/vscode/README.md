# A3 Problem-Solving (VS Code extension)

Renders markdown files as a Toyota-style A3 problem-solving report (the format from "Managing to Learn"): a 42cm x 29.7cm two-column A3 landscape page, scaled to fit the pane, with mermaid diagrams.

## Usage

- **A3: Open as A3** (command palette, editor title button, editor or explorer context menu of a markdown file): open the A3 view beside the editor. It re-renders as you type.
- **A3: Create new A3** (command palette): create `Untitled A3.md` in the workspace root pre-filled with the A3 template and open it in A3 view.
- In the A3 view, the editor title actions are:
  - **export**: save the page as a standalone HTML file and open it in the browser, ready to print on A3 landscape paper;
  - **edit**: open the markdown source;
  - **+ / -**: adjust the page font size (7-13pt). Mermaid diagrams are re-rendered to match, so their boxes are laid out around the resized text. The size is remembered per file.

## Markdown support

Markdown is rendered with markdown-it (CommonMark, tables, strikethrough, task lists) plus fenced `mermaid` blocks rendered by the bundled mermaid. Raw HTML is kept, minus scripts and event handlers. Relative image paths resolve from the file's folder.

## Credits

Diagrams are rendered by [mermaid](https://github.com/mermaid-js/mermaid) (MIT license, Copyright (c) 2014-present Knut Sveidqvist), which is bundled with the extension. Markdown is rendered by [markdown-it](https://github.com/markdown-it/markdown-it) (MIT license).

## License

[MIT](LICENSE)
