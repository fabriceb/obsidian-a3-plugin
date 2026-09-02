// Page font size bounds, in points. The A3 spec's body text is 10pt; the
// range lets dense reports shrink and sparse ones grow to fill the page.
export const MIN_FONT_SIZE_PT = 7;
export const MAX_FONT_SIZE_PT = 13;
export const DEFAULT_FONT_SIZE_PT = MAX_FONT_SIZE_PT;

// The original, pre-adjustable page size, used as the anchor for scaling
// mermaid's label font size so it re-lays-out diagrams (node boxes
// included) to match, instead of just visually zooming the rendered SVG.
export const BASE_FONT_SIZE_PT = 10;
export const BASE_MERMAID_FONT_SIZE_PX = 10;

export function clampFontSizePt(pt: number): number {
    return Math.min(MAX_FONT_SIZE_PT, Math.max(MIN_FONT_SIZE_PT, Math.round(pt)));
}

export function mermaidFontSizePx(fontSizePt: number): number {
    return (BASE_MERMAID_FONT_SIZE_PX * fontSizePt) / BASE_FONT_SIZE_PT;
}
