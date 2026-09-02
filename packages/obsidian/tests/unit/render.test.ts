import { describe, expect, it, vi } from "vitest";
import { TFile } from "obsidian";
import { makeView, priv } from "../helpers";

describe("rendering through the core renderer", () => {
    it("renders the note data into the content element at the view's font size", async () => {
        const { view } = makeView();
        view.setViewData("# Hello", false);
        await vi.waitFor(() => {
            expect(view.contentEl.querySelector(".a3-page h1")?.textContent).toBe(
                "Hello"
            );
        });
        const page = view.contentEl.querySelector<HTMLElement>(".a3-page");
        expect(page?.style.getPropertyValue("--a3-font-size")).toBe("13pt");
    });

    it("defers rendering until the workspace layout is ready", async () => {
        const { view, app } = makeView();
        app.workspace.layoutReady = false;
        let deferred: (() => void) | null = null;
        app.workspace.onLayoutReady = (cb: () => void) => {
            deferred = cb;
        };
        view.setViewData("# Hello", false);
        await Promise.resolve();
        expect(view.contentEl.querySelector(".a3-page")).toBeNull();
        app.workspace.layoutReady = true;
        deferred!();
        await vi.waitFor(() => {
            expect(view.contentEl.querySelector(".a3-page")).not.toBeNull();
        });
    });

    it("clear drops the page", async () => {
        const { view } = makeView();
        view.setViewData("# Hello", false);
        await vi.waitFor(() => {
            expect(view.contentEl.querySelector(".a3-page")).not.toBeNull();
        });
        view.clear();
        expect(view.contentEl.childElementCount).toBe(0);
    });

    it("resolves relative image paths through the vault, from the note's folder", () => {
        const { view, app } = makeView();
        const img = new TFile("Reports/img/chart.png", "chart", "png");
        app.metadataCache.getFirstLinkpathDest.mockReturnValue(img);
        expect(priv(view).resolveImageSrc("img/chart%20x.png")).toBe(
            "app://vault/Reports/img/chart.png"
        );
        expect(app.metadataCache.getFirstLinkpathDest).toHaveBeenCalledWith(
            "img/chart x.png",
            "Report.md"
        );
        app.metadataCache.getFirstLinkpathDest.mockReturnValue(null);
        expect(priv(view).resolveImageSrc("missing.png")).toBe("missing.png");
    });
});
