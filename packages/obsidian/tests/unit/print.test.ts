import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { notices, Platform } from "../mocks/obsidian";
import { makeView, priv } from "../helpers";

interface FakeNode {
    written: { path: string; data: string }[];
    openedPaths: string[];
    openPathResult: string;
}

function installFakeRequire(): FakeNode {
    const state: FakeNode = {
        written: [],
        openedPaths: [],
        openPathResult: "",
    };
    const modules: Record<string, unknown> = {
        os: { tmpdir: () => "/tmp/fake" },
        path: { join: (...parts: string[]) => parts.join("/") },
        fs: {
            writeFileSync: (path: string, data: string) => {
                state.written.push({ path, data });
            },
        },
        electron: {
            shell: {
                openPath: async (path: string) => {
                    state.openedPaths.push(path);
                    return state.openPathResult;
                },
            },
        },
    };
    (window as unknown as { require: unknown }).require = (id: string) =>
        modules[id];
    return state;
}

const PAGE_MARKUP = '<div class="a3-page"><h1>Title</h1></div>';

function viewWithPage() {
    const made = makeView();
    vi.spyOn(priv(made.view).renderer, "getPrintMarkup").mockReturnValue(
        PAGE_MARKUP
    );
    return made;
}

async function printedExport(
    css = "/* plugin css */"
): Promise<{ node: FakeNode; html: string }> {
    const node = installFakeRequire();
    const { view, app } = viewWithPage();
    app.vault.adapter.read.mockResolvedValue(css);
    await priv(view).printA3();
    expect(node.written).toHaveLength(1);
    return { node, html: node.written[0].data };
}

beforeEach(() => {
    Platform.isDesktopApp = true;
});

afterEach(() => {
    delete (window as unknown as { require?: unknown }).require;
});

describe("printA3", () => {
    it("writes a standalone HTML export next to the temp dir and opens it", async () => {
        const { node, html } = await printedExport();
        expect(node.written[0].path).toBe("/tmp/fake/Report (A3 print).html");
        expect(node.openedPaths).toEqual([node.written[0].path]);
        expect(html).toContain("<!DOCTYPE html>");
        expect(html).toContain("<title>Report</title>");
        expect(html).toContain(PAGE_MARKUP);
        expect(html).toContain("size: a3 landscape");
    });

    it("inlines the plugin stylesheet read from the plugin folder", async () => {
        const { html } = await printedExport(".a3-page { width: 42cm; }");
        expect(html).toContain(".a3-page { width: 42cm; }");
    });

    it("refuses politely on non-desktop platforms", async () => {
        installFakeRequire();
        Platform.isDesktopApp = false;
        const { view } = viewWithPage();
        await priv(view).printA3();
        expect(notices).toEqual(["Printing is only available on desktop."]);
    });

    it("does nothing before a page has rendered", async () => {
        const node = installFakeRequire();
        const { view } = makeView();
        await priv(view).printA3();
        expect(node.written).toHaveLength(0);
        expect(notices).toHaveLength(0);
    });

    it("shows a notice when the browser cannot open the export", async () => {
        const node = installFakeRequire();
        node.openPathResult = "No application found";
        vi.spyOn(console, "error").mockImplementation(() => {});
        const { view } = viewWithPage();
        await priv(view).printA3();
        expect(notices).toEqual([
            "Could not open the print export in the browser.",
        ]);
    });

    it("still exports when styles.css cannot be read", async () => {
        const node = installFakeRequire();
        const { view, app } = viewWithPage();
        app.vault.adapter.read.mockRejectedValue(new Error("gone"));
        vi.spyOn(console, "error").mockImplementation(() => {});
        await priv(view).printA3();
        expect(node.written).toHaveLength(1);
        expect(notices).toHaveLength(0);
    });
});
