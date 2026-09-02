/* Polyfills for the DOM helper methods Obsidian adds to HTMLElement.
   main.ts relies on them; jsdom does not have them. */
import { beforeEach, vi } from "vitest";
import { notices } from "./mocks/obsidian";

const proto = HTMLElement.prototype as HTMLElement & Record<string, unknown>;

proto.toggleClass = function (
    this: HTMLElement,
    cls: string | string[],
    value: boolean
): void {
    for (const c of Array.isArray(cls) ? cls : [cls]) {
        this.classList.toggle(c, value);
    }
};

beforeEach(() => {
    // resetAllMocks (not clearAllMocks): also restores the original
    // implementations, so a per-test mockImplementation cannot leak into
    // the next test.
    vi.resetAllMocks();
    notices.length = 0;
});
