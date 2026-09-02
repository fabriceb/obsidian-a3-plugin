import { describe, expect, it, vi } from "vitest";
import type { ViewStateResult } from "obsidian";
import { makeView, priv } from "../helpers";

const RESULT = { history: false } as ViewStateResult;

describe("font size state", () => {
    it("defaults to the maximum (13pt)", () => {
        const { view } = makeView();
        expect(priv(view).fontSizePt).toBe(13);
    });

    it("getState includes fontSizePt alongside the base state", () => {
        const { view } = makeView();
        const state = view.getState();
        expect(state.fontSizePt).toBe(13);
        expect(state.file).toBe("Report.md");
    });

    it("setState applies a stored font size", async () => {
        const { view } = makeView();
        await view.setState({ fontSizePt: 9 }, RESULT);
        expect(priv(view).fontSizePt).toBe(9);
    });

    it("setState clamps below the minimum to 7pt", async () => {
        const { view } = makeView();
        await view.setState({ fontSizePt: 2 }, RESULT);
        expect(priv(view).fontSizePt).toBe(7);
    });

    it("setState clamps above the maximum to 13pt", async () => {
        const { view } = makeView();
        await view.setState({ fontSizePt: 9 }, RESULT);
        await view.setState({ fontSizePt: 99 }, RESULT);
        expect(priv(view).fontSizePt).toBe(13);
    });

    it("setState rounds fractional sizes", async () => {
        const { view } = makeView();
        await view.setState({ fontSizePt: 9.6 }, RESULT);
        expect(priv(view).fontSizePt).toBe(10);
    });

    it("setState ignores a missing or non-numeric fontSizePt", async () => {
        const { view } = makeView();
        await view.setState({ file: "Report.md" }, RESULT);
        expect(priv(view).fontSizePt).toBe(13);
        await view.setState({ fontSizePt: "big" }, RESULT);
        expect(priv(view).fontSizePt).toBe(13);
        await view.setState(null, RESULT);
        expect(priv(view).fontSizePt).toBe(13);
    });

    it("setState re-renders when the size changed and a page is showing", async () => {
        const { view } = makeView();
        const p = priv(view);
        vi.spyOn(p.renderer, "getPage").mockReturnValue(
            document.createElement("div")
        );
        const render = vi
            .spyOn(p, "render" as never)
            .mockImplementation(() => undefined as never);
        await view.setState({ fontSizePt: 8 }, RESULT);
        expect(render).toHaveBeenCalledTimes(1);
    });

    it("setState does not re-render when the size is unchanged", async () => {
        const { view } = makeView();
        const p = priv(view);
        vi.spyOn(p.renderer, "getPage").mockReturnValue(
            document.createElement("div")
        );
        const render = vi
            .spyOn(p, "render" as never)
            .mockImplementation(() => undefined as never);
        await view.setState({ fontSizePt: 13 }, RESULT);
        expect(render).not.toHaveBeenCalled();
    });

    it("setState does not double-render when super.setState already started one", async () => {
        const { view } = makeView();
        const p = priv(view);
        vi.spyOn(p.renderer, "getPage").mockReturnValue(
            document.createElement("div")
        );
        const render = vi
            .spyOn(p, "render" as never)
            .mockImplementation(() => undefined as never);
        // Simulate the base class kicking off a fresh render (file load):
        // the sequence number moves on while setState awaits it.
        const base = Object.getPrototypeOf(Object.getPrototypeOf(view)) as {
            setState: (s: unknown, r: ViewStateResult) => Promise<void>;
        };
        const originalSetState = base.setState;
        base.setState = async function (this: unknown) {
            (view as unknown as { renderCount: number }).renderCount++;
        };
        try {
            await view.setState({ fontSizePt: 8 }, RESULT);
        } finally {
            base.setState = originalSetState;
        }
        expect(priv(view).fontSizePt).toBe(8);
        expect(render).not.toHaveBeenCalled();
    });
});

describe("setFontSizePt via the +/- actions", () => {
    async function openedView() {
        const { view, app } = makeView();
        await view.onOpen();
        const p = priv(view);
        const render = vi
            .spyOn(p, "render" as never)
            .mockImplementation(() => undefined as never);
        return { view, app, p, render };
    }

    it("decrement lowers the size, saves the layout and re-renders", async () => {
        const { app, p, render } = await openedView();
        p.decreaseFontAction?.click();
        expect(p.fontSizePt).toBe(12);
        expect(app.workspace.requestSaveLayout).toHaveBeenCalledTimes(1);
        expect(render).toHaveBeenCalledTimes(1);
    });

    it("increment at the maximum is a no-op", async () => {
        const { app, p, render } = await openedView();
        p.increaseFontAction?.click();
        expect(p.fontSizePt).toBe(13);
        expect(app.workspace.requestSaveLayout).not.toHaveBeenCalled();
        expect(render).not.toHaveBeenCalled();
    });

    it("never goes below 7pt no matter how often - is clicked", async () => {
        const { p } = await openedView();
        for (let i = 0; i < 20; i++) p.decreaseFontAction?.click();
        expect(p.fontSizePt).toBe(7);
    });

    it("marks the + action disabled at the maximum and - at the minimum", async () => {
        const { view, p } = await openedView();
        expect(p.increaseFontAction?.classList.contains("is-disabled")).toBe(
            true
        );
        expect(p.decreaseFontAction?.classList.contains("is-disabled")).toBe(
            false
        );
        await view.setState({ fontSizePt: 7 }, RESULT);
        expect(p.increaseFontAction?.classList.contains("is-disabled")).toBe(
            false
        );
        expect(p.decreaseFontAction?.classList.contains("is-disabled")).toBe(
            true
        );
        await view.setState({ fontSizePt: 10 }, RESULT);
        expect(p.increaseFontAction?.classList.contains("is-disabled")).toBe(
            false
        );
        expect(p.decreaseFontAction?.classList.contains("is-disabled")).toBe(
            false
        );
    });
});
