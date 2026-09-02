# A3 Problem-Solving

Render markdown as a Toyota-style A3 problem-solving report (the format from "Managing to Learn"): a 42cm x 29.7cm two-column A3 landscape page, scaled to fit the pane, with mermaid diagrams, adjustable font size and a print export.

![A3 view](packages/obsidian/screenshot.png)

This repository holds three packages:

| Package | What it is |
|---|---|
| [`packages/core`](packages/core) | The shared, host-agnostic renderer: markdown (markdown-it) to an A3 page, mermaid diagrams re-laid-out at the chosen font size, fit-to-pane zoom, the standalone print export and the A3 template. |
| [`packages/obsidian`](packages/obsidian) | The Obsidian plugin ("A3 Problem-Solving"). |
| [`packages/vscode`](packages/vscode) | The VS Code extension ("A3 Problem-Solving"). |

## Development

```
npm install
npm run build        # type-check and bundle every package
npm test             # unit tests (vitest, jsdom)
npm run lint
npm run dev:obsidian # watch mode for the Obsidian plugin
npm run dev:vscode   # watch mode for the VS Code extension
```

To try the VS Code extension, open `packages/vscode` in VS Code and press F5 (Run Extension), or build a `.vsix` with `npm run package --workspace packages/vscode`.

The Obsidian plugin's end-to-end scenarios live in `packages/obsidian/tests/e2e`.

## Releasing

Releases are cut by pushing a tag; `.github/workflows/release.yml` builds and attaches the artifacts as a draft GitHub release.

- **Obsidian plugin**: bump `version` in `packages/obsidian/manifest.json` and add it to `versions.json`, then tag with the bare version (`0.2.0`). Obsidian requires the tag to equal the manifest version. The release carries `main.js`, `manifest.json` and `styles.css`.
- **VS Code extension**: bump `version` in `packages/vscode/package.json`, then tag `vscode-v<version>` (`vscode-v0.1.0`). The release carries the `.vsix`; when a `VSCE_PAT` repository secret is set, the workflow also publishes it to the Visual Studio Marketplace.

## License

[MIT](LICENSE)
