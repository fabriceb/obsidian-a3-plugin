// Standalone HTML export of a rendered page, for printing from a browser
// on A3 landscape paper. DOM-free so it can run on a Node host too.

export interface PrintExportOptions {
    title: string;
    // The page element's outer HTML at true size (see
    // A3Renderer.getPrintMarkup).
    pageMarkup: string;
    // The A3 stylesheet (styles.css), inlined so the export is
    // self-contained.
    css: string;
}

function escapeHtml(text: string): string {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

export function buildPrintHtml({ title, pageMarkup, css }: PrintExportOptions): string {
    return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<style>${css}</style>
<style>
body {
    margin: 0;
    padding: 0;
    background-color: #888888;
}
@media print {
    body { padding: 0; background-color: #ffffff; }

    /* The exported page has its fit-zoom removed at export time, so it is
       already at true size. The 1em inner padding is part of the page, so
       it is not zeroed. These rules are only here (not in styles.css)
       because @page cannot be scoped and would otherwise affect the host
       app's own printing (e.g. Obsidian's native Export to PDF). */
    .a3-page {
        width: 42cm;
        height: 29.7cm;
        margin: 0;
        border: none;
        box-shadow: none;
    }

    @page {
        size: a3 landscape;
        margin: 0;
    }
}
</style>
</head>
<body>
${pageMarkup}
</body>
</html>
`;
}

// File name for the export, derived from the document title.
export function printExportFileName(title: string): string {
    const safeName = title.replace(/[^\wÀ-ɏ -]+/g, "_");
    return `${safeName} (A3 print).html`;
}
