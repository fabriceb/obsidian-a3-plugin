import esbuild from "esbuild";
import process from "process";

const prod = process.argv[2] === "production";

// The extension host bundle (Node): commands, panels, print export. It
// imports only the DOM-free parts of @a3/core, so mermaid stays out.
const host = await esbuild.context({
    entryPoints: [{ in: "src/extension.ts", out: "extension" }],
    bundle: true,
    platform: "node",
    format: "cjs",
    target: "node18",
    external: ["vscode"],
    sourcemap: prod ? false : "inline",
    minify: prod,
    logLevel: "info",
    outdir: "dist",
});

// The webview bundle (browser): the A3 renderer with mermaid, plus the
// stylesheets (a3.css is the shared page stylesheet, also inlined into
// print exports; webview.css styles the pane around it).
const webview = await esbuild.context({
    entryPoints: [
        { in: "src/webview/index.ts", out: "webview" },
        { in: "src/webview/webview.css", out: "webview" },
        { in: "../core/src/styles.css", out: "a3" },
    ],
    bundle: true,
    platform: "browser",
    format: "iife",
    target: "es2020",
    sourcemap: prod ? false : "inline",
    minify: prod,
    logLevel: "info",
    outdir: "dist",
});

if (prod) {
    await Promise.all([host.rebuild(), webview.rebuild()]);
    process.exit(0);
} else {
    await Promise.all([host.watch(), webview.watch()]);
}
