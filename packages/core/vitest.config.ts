import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
    resolve: {
        alias: {
            // Real mermaid needs a browser layout engine; tests use a stub.
            mermaid: fileURLToPath(
                new URL("./tests/mocks/mermaid.ts", import.meta.url)
            ),
        },
    },
    test: {
        environment: "jsdom",
        setupFiles: ["./tests/setup.ts"],
        include: ["tests/**/*.test.ts"],
    },
});
