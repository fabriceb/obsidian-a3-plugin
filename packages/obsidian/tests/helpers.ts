import { vi } from "vitest";
import { TFile, WorkspaceLeaf } from "obsidian";
import type { A3Renderer } from "@a3/core";
import { A3View } from "../src/main";
import type A3Plugin from "../src/main";

export interface TestApp {
    workspace: {
        layoutReady: boolean;
        onLayoutReady: (cb: () => void) => void;
        requestSaveLayout: ReturnType<typeof vi.fn>;
    };
    vault: {
        adapter: { read: ReturnType<typeof vi.fn> };
        getResourcePath: ReturnType<typeof vi.fn>;
    };
    metadataCache: {
        getFirstLinkpathDest: ReturnType<typeof vi.fn>;
    };
}

export function makeApp(): TestApp {
    return {
        workspace: {
            layoutReady: true,
            onLayoutReady: (cb: () => void) => cb(),
            requestSaveLayout: vi.fn(),
        },
        vault: {
            adapter: {
                read: vi.fn(async () => "/* plugin css */"),
            },
            getResourcePath: vi.fn((file: TFile) => `app://vault/${file.path}`),
        },
        metadataCache: {
            getFirstLinkpathDest: vi.fn(() => null),
        },
    };
}

export function makeView(app: TestApp = makeApp()): {
    view: A3View;
    app: TestApp;
} {
    const leaf = new WorkspaceLeaf(app);
    const plugin = {
        manifest: { dir: ".obsidian/plugins/athree-problem-solving" },
    } as unknown as A3Plugin;
    const view = new A3View(leaf, plugin);
    view.file = new TFile("Report.md", "Report");
    return { view, app };
}

// Reach private members without sprinkling casts through the tests.
export function priv(view: A3View): {
    render: () => void;
    setFontSizePt: (pt: number) => void;
    fontSizePt: number;
    renderer: A3Renderer;
    renderCount: number;
    increaseFontAction: HTMLElement | null;
    decreaseFontAction: HTMLElement | null;
    printA3: () => Promise<void>;
    resolveImageSrc: (src: string) => string;
} {
    return view as unknown as ReturnType<typeof priv>;
}
