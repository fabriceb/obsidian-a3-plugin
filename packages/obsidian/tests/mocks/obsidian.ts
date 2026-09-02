/* Minimal stand-in for the "obsidian" module (which only exists inside the
   app). Vitest aliases the import here; each piece implements just enough
   of the real API surface that main.ts touches. */
import { vi } from "vitest";

// Notices shown during a test, oldest first. Cleared in tests/setup.ts.
export const notices: string[] = [];

export class Notice {
    constructor(message: string) {
        notices.push(message);
    }
}

export const Platform = {
    isDesktopApp: true,
};

export class MarkdownView {}

export class TFile {
    constructor(public path = "", public basename = "", public extension = "md") {}
}

export class Menu {
    items: unknown[] = [];
    addItem(cb: (item: unknown) => void): this {
        const item = {
            setTitle: () => item,
            setIcon: () => item,
            setSection: () => item,
            onClick: () => item,
        };
        cb(item);
        this.items.push(item);
        return this;
    }
}

export class WorkspaceLeaf {
    app: unknown;
    setViewState = vi.fn(async () => {});
    getViewState = vi.fn(() => ({ state: {} }));
    constructor(app: unknown) {
        this.app = app;
    }
}

export interface ViewStateResult {
    history: boolean;
}

class View {
    app: { workspace: unknown; vault: unknown };
    leaf: WorkspaceLeaf;
    containerEl: HTMLElement;
    constructor(leaf: WorkspaceLeaf) {
        this.leaf = leaf;
        this.app = leaf.app as View["app"];
        this.containerEl = document.createElement("div");
    }
    addAction(icon: string, title: string, cb: () => void): HTMLElement {
        const el = document.createElement("a");
        el.dataset.icon = icon;
        el.setAttribute("aria-label", title);
        el.addEventListener("click", cb);
        this.containerEl.appendChild(el);
        return el;
    }
    registerEvent(): void {}
}

export class TextFileView extends View {
    file: TFile | null = null;
    data = "";
    contentEl: HTMLElement;
    constructor(leaf: WorkspaceLeaf) {
        super(leaf);
        this.contentEl = document.createElement("div");
        this.containerEl.appendChild(this.contentEl);
    }
    getState(): Record<string, unknown> {
        return { file: this.file?.path ?? null };
    }
    // The real implementation resolves the file and eventually triggers
    // setViewData; tests that need that behavior stub it explicitly.
    async setState(
        _state: unknown,
        _result: ViewStateResult
    ): Promise<void> {}
}

export class Plugin {
    app: unknown;
    manifest: { dir?: string };
    constructor(app: unknown, manifest: { dir?: string }) {
        this.app = app;
        this.manifest = manifest;
    }
    registerView(): void {}
    addCommand(): void {}
    registerEvent(): void {}
}
