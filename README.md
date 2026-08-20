# A3 Problem-Solving (Obsidian plugin)

Renders markdown notes as a Toyota-style A3 problem-solving report (the format from "Managing to Learn"): a 42cm x 29.7cm two-column A3 landscape page, scaled to fit the pane, with mermaid diagrams rendered by Obsidian's built-in pipeline.

A note gets three ways to look at it: Obsidian's Reading view, Source mode / Live Preview, and the plugin's **A3 view**.

## Usage

- **Toggle A3 view** (command palette): switch the active note between markdown and A3 view.
- **Open as A3**: right-click a markdown file in the file explorer, or use the editor context menu.
- **Create new A3** (command palette): create a note pre-filled with the A3 template and open it in A3 view.
- In A3 view, the pencil icon in the tab header switches back to markdown.

## Development

```
npm install
npm run dev     # watch mode
npm run build   # type-check + production bundle
```

Install into a vault by symlinking this folder into the vault's plugin directory:

```
ln -s /path/to/obsidian-a3-plugin "/path/to/Vault/.obsidian/plugins/a3-problem-solving"
```

Then enable "A3 Problem-Solving" in Settings > Community plugins (toggle off Restricted mode if needed). After a rebuild, reload Obsidian (Cmd+R) or use the Hot Reload plugin.

## Origin

Ported from the standalone [a3-problem-solving-markdown-editor](../a3-problem-solving-markdown-editor): the A3 page CSS, the fit-to-screen zoom logic (including the "render mermaid at zoom 1, fit afterwards" fix - mermaid measures its HTML labels with getBoundingClientRect(), which an ancestor's CSS zoom would distort), and the embedded A3 template. Marked.js, DOMPurify, and the mermaid CDN are replaced by Obsidian's `MarkdownRenderer`.
