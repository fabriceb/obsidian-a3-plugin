/* Stand-in for the bundled mermaid package: records initialize() calls and
   renders a recognizable fake SVG so tests can assert on the adopted DOM
   without paying for (or depending on) real diagram layout. */
import { vi } from "vitest";

export const initialize = vi.fn();

export const render = vi.fn(
    async (id: string, source: string, _container: HTMLElement) => ({
        svg: `<svg id="${id}" viewBox="0 0 100 100"><foreignObject><div>${source}</div></foreignObject></svg>`,
        bindFunctions: undefined as ((el: Element) => void) | undefined,
    })
);

export default { initialize, render };
