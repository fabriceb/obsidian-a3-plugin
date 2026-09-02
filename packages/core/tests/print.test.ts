import { describe, expect, it } from "vitest";
import { buildPrintHtml, printExportFileName } from "../src/print";

describe("buildPrintHtml", () => {
    const html = buildPrintHtml({
        title: "Report <1>",
        pageMarkup: '<div class="a3-page"><h1>Title</h1></div>',
        css: ".a3-page { width: 42cm; }",
    });

    it("is a standalone document carrying the page and the stylesheet", () => {
        expect(html).toContain("<!DOCTYPE html>");
        expect(html).toContain("<title>Report &lt;1&gt;</title>");
        expect(html).toContain(".a3-page { width: 42cm; }");
        expect(html).toContain('<div class="a3-page"><h1>Title</h1></div>');
    });

    it("carries the A3 landscape print rules itself, keeping @page out of styles.css", () => {
        // An @page rule cannot be scoped, so if it lived in styles.css it
        // would hijack the host's own printing (Obsidian's Export to PDF).
        expect(html).toContain("@page");
        expect(html).toContain("size: a3 landscape");
        expect(html).toContain("@media print");
    });
});

describe("printExportFileName", () => {
    it("derives a safe file name from the title", () => {
        expect(printExportFileName("Report")).toBe("Report (A3 print).html");
        expect(printExportFileName('Q3: A/B "läuft"?')).toBe(
            "Q3_ A_B _läuft_ (A3 print).html"
        );
    });
});
