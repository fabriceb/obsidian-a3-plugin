export function defineSize(
    el: HTMLElement,
    sizes: Partial<
        Record<
            | "clientWidth"
            | "clientHeight"
            | "scrollWidth"
            | "offsetWidth"
            | "offsetHeight",
            number
        >
    >
): void {
    for (const [key, value] of Object.entries(sizes)) {
        Object.defineProperty(el, key, { value, configurable: true });
    }
}

// jsdom cannot select camelCase SVG tags, so find labels by tag name.
export function mermaidLabel(root: HTMLElement): HTMLElement | null {
    const fo = root.getElementsByTagName("foreignObject")[0];
    return (fo?.getElementsByTagName("div")[0] as HTMLElement) ?? null;
}
