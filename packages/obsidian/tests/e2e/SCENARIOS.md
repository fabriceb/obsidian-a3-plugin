# E2E scenarios - Claude-driven via the `electron` MCP server

These tests are executed by Claude Code interacting with a live Obsidian
instance through the `electron` MCP server (declared in `.mcp.json`,
implemented by `@laststance/electron-mcp-server`), which attaches to
Obsidian's Chrome DevTools Protocol port.

## Setup

1. Start a Claude Code session in this repo (so the `electron` MCP server
   is loaded) and make sure Obsidian is not running. Paths below are
   relative to `packages/obsidian`.
2. Run `tests/e2e/launch-obsidian.sh` (builds the plugin, registers
   `tests/e2e/vault` in Obsidian's global vault list if it isn't already
   there - required or `obsidian://open?path=...` fails with "Vault not
   found" - then launches Obsidian with `--remote-debugging-port=9222`
   and opens the vault).
3. On the first run, accept Obsidian's "Trust author and enable plugins"
   dialog manually (it is a native-ish modal; do not automate it blindly).
4. Tell Claude: "run the e2e scenarios in
   packages/obsidian/tests/e2e/SCENARIOS.md".

Conventions for the executing agent:

- Use the MCP tools to take screenshots, click by selector, and evaluate
  JavaScript in the Obsidian window. Every `EVAL:` block below is a
  JavaScript expression to evaluate in the app; the expected value
  follows. Report each scenario as PASS or FAIL with the observed value,
  and stop automating (ask the user) if the app shows a modal dialog.
- Obsidian's API is reachable from evaluated JS via `app` (the global).
- Between steps that trigger re-renders, wait ~1 second: the plugin has a
  400 ms self-heal pass after each render.

### electron MCP quirks (learned the hard way)

- **`electron_eval` rejects some function calls as "Function calls in
  eval are restricted", and the rule is not just a fixed name
  blocklist.** Plain DOM query/style reads (`querySelector`,
  `querySelectorAll`, `getComputedStyle`, `getPropertyValue`,
  `getAttribute`, `classList.contains`, `trim`) always work. Calling app
  API methods directly (`app.workspace.getLeaf(...)`, `.getViewType()`,
  `.getName()`, `.constructor`) is always blocked. But general-purpose
  methods like `Array.from`, `.flatMap`, `.reduce`, and
  `String.prototype.includes` are blocked in some calls and allowed in
  others - e.g. `Array.from(document.querySelectorAll(".mermaid"))
  .flatMap(...).every(...)` over DOM elements passes, while
  `Array.from(document.styleSheets).flatMap(...)` over stylesheets/CSS
  rules is rejected. Don't assume a call is blocked just because the
  method name matches a previous failure - try it, and fall back to a
  static source-code check (grepping the repo) only if it's actually
  rejected. Variable declarations/assignments (`let x = ...`) are always
  rejected.
- **A literal `=` inside an eval string false-positives as an
  assignment.** An attribute selector like `[aria-label="X"]` written
  directly in `electron_eval` code trips "Assignment operations in eval
  are restricted". Work around it by escaping the `=` as `\x3D`, e.g.
  `document.querySelector('...[aria-label\x3D"Increase font size"]')`.
  This only matters for `electron_eval` code strings — the `selector`
  parameter of `electron_click_by_selector` /
  `electron_wait_for_selector` is plain data and needs no escaping.
- **`electron_take_screenshot` can return the wrong window's content**
  when multiple Electron windows are open (e.g. the e2e vault plus
  another vault like FabBrain) — it appears to grab whatever is
  frontmost on screen rather than rendering the specific `targetId`.
  Don't trust a screenshot to confirm which vault/window you're looking
  at; confirm with `electron_eval` instead (e.g.
  `app.vault.adapter.basePath`, itself a property read, not a call).
- **Clicking a sidebar item (e.g. the file explorer) makes the sidebar
  leaf "active", not the main pane.** Commands with a `checkCallback`
  that requires an active `MarkdownView` (like "Toggle A3 view") won't
  even appear in the command palette until the main editor pane is
  focused. Click into the editor content (`.cm-content`) before opening
  the command palette, not just the file's row in the sidebar.

## Scenario 1 - Open a note as A3

1. Open "Sample A3.md" (click it in the file explorer), then click into
   the editor content (`.cm-content`) so the main pane - not the
   sidebar - becomes the active leaf (see quirks above; `setViewState`
   itself is blocked in `electron_eval`).
2. Open the command palette (`Meta+P`), type "Toggle A3 view", confirm
   it appears as a suggestion, then press Enter.
3. Wait 1.5 s, then screenshot: a white landscape page must be visible.
4. EVAL: `!!document.querySelector(".a3-page")` -> `true`
5. EVAL: `getComputedStyle(document.querySelector(".a3-page")).columnCount` -> `"2"`
6. EVAL: `document.querySelectorAll(".a3-page .mermaid svg").length` -> `1`
   (the bundled mermaid rendered the diagram, not Obsidian's pipeline)
7. EVAL: `document.querySelectorAll(".a3-page pre > code.language-a3-mermaid").length` -> `0`
   (no leftover unrendered a3-mermaid block)

## Scenario 2 - Font size actions re-render mermaid

1. EVAL (record the current diagram width):
   `document.querySelector(".a3-page .mermaid svg").getAttribute("viewBox")`
   -> remember as `viewBoxBefore`.
2. Click the view action with selector
   `.workspace-leaf.mod-active .view-action[aria-label="Decrease font size"]`.
3. Wait 1.5 s.
4. EVAL: `getComputedStyle(document.querySelector(".a3-page")).getPropertyValue("--a3-font-size").trim()` -> `"12pt"`
5. EVAL: the viewBox expression from step 1 -> must differ from
   `viewBoxBefore` (the diagram re-laid-out, it did not just zoom).

## Scenario 3 - Bounds and disabled state

1. Click `[aria-label="Increase font size"]` (same leaf scope) repeatedly
   until EVAL `getComputedStyle(document.querySelector(".a3-page")).getPropertyValue("--a3-font-size").trim()` -> `"13pt"`.
2. EVAL (note the escaped `=`, see quirks above):
   `document.querySelector('.workspace-leaf.mod-active .view-action[aria-label\x3D"Increase font size"]').classList.contains("is-disabled")` -> `true`
3. One more click on "Increase font size".
4. EVAL: the font size property -> still `"13pt"`.

## Scenario 4 - Font size survives a restart, diagrams stay healthy

Regression test for the startup mis-measurement bug (labels rendered at
the default size while the page used the persisted size).

1. Set the size to 9pt using the "Decrease font size" action, verify via
   the `--a3-font-size` EVAL -> `"9pt"`.
2. Quit Obsidian cleanly from the shell (so the layout is saved):
   `osascript -e 'quit app "Obsidian"'`, wait for the process to exit,
   then rerun `tests/e2e/launch-obsidian.sh` and reattach.
3. Wait for the vault to load (the A3 view is restored from the layout).
4. EVAL: `getComputedStyle(document.querySelector(".a3-page")).getPropertyValue("--a3-font-size").trim()` -> `"9pt"`
5. EVAL (no mermaid label overflows its node box):
   `Array.from(document.querySelectorAll(".a3-page .mermaid")).flatMap(m => Array.from(m.getElementsByTagName("foreignObject"))).flatMap(fo => Array.from(fo.getElementsByTagName("div"))).every(el => el.scrollWidth <= el.clientWidth + 1)` -> `true`
   (this exact `Array.from`/`.flatMap`/`.every` chain over DOM elements
   is allowed; see quirks above - the restriction on array/string methods
   seems to key off what's being iterated, not the method names alone,
   so don't assume every such call is blocked without trying it)

## Scenario 5 - Print export

1. Click `.workspace-leaf.mod-active .view-action[aria-label="Open in browser to print"]`.
   (This opens the default browser; that is expected and can be closed.)
2. From the shell: `ls "$TMPDIR"/*A3\ print*.html` -> the export exists.
3. From the shell, grep that file: it must contain `@page`,
   `size: a3 landscape`, and `class="a3-page"`.

## Scenario 6 - Native Export to PDF stays untouched (0.1.6 regression)

The plugin's stylesheet, as loaded in the app, must not carry any @page
rule: an @page rule cannot be scoped and would override the page size of
Obsidian's native Export to PDF for every note.

1. Try EVAL:
   `Array.from(document.styleSheets).flatMap(s => { try { return Array.from(s.cssRules); } catch { return []; } }).filter(r => r.constructor.name === "CSSPageRule" || (r.cssText || "").includes("@page")).length` -> `0`

   If `electron_eval` rejects this (it has, with "Function calls in eval
   are restricted" on `Array.from`/`.constructor`/`.includes` over
   `document.styleSheets` specifically - see quirks above), fall back to
   a static check instead, since the built `styles.css` is what's
   actually loaded into the app unmodified: `grep -n "@page" styles.css`
   in `packages/obsidian` (after a build) must match nothing but a comment
   (no live `@page {` rule). Also grep `packages/core/src/print.ts` to
   confirm the only `@page {` rule lives inside the print-export HTML
   template string, not in any stylesheet.
2. EVAL (the plugin styles are actually loaded, so step 1 is meaningful):
   `Array.from(document.styleSheets).some(s => { try { return Array.from(s.cssRules).some(r => (r.selectorText || "").includes(".a3-page")); } catch { return false; } })` -> `true`

   Static fallback: `grep -c "\.a3-page" styles.css` (the built file in
   `packages/obsidian`) returns a non-zero count.
