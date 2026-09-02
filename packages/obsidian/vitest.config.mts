import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
    resolve: {
        alias: {
            // The "obsidian" module only exists inside the app.
            obsidian: fileURLToPath(
                new URL("./tests/mocks/obsidian.ts", import.meta.url)
            ),
            // Real mermaid needs a browser layout engine; tests use a stub.
            mermaid: fileURLToPath(
                new URL("../core/tests/mocks/mermaid.ts", import.meta.url)
            ),
        },
    },
    test: {
        environment: "jsdom",
        setupFiles: ["./tests/setup.ts"],
        include: ["tests/unit/**/*.test.ts"],
    },
});
