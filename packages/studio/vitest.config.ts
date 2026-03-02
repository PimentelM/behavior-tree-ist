import { defineConfig } from "vitest/config";

const fromRoot = (relativePath: string) => new URL(relativePath, import.meta.url).pathname;

export default defineConfig({
    resolve: {
        alias: [
            {
                find: '@behavior-tree-ist/studio-transport',
                replacement: fromRoot('../studio-transport/src/index.ts'),
            },
            {
                find: '@behavior-tree-ist/core/builder',
                replacement: fromRoot('../core/src/builder/index.ts'),
            },
            {
                find: '@behavior-tree-ist/core/inspector',
                replacement: fromRoot('../core/src/inspector/index.ts'),
            },
            {
                find: '@behavior-tree-ist/core',
                replacement: fromRoot('../core/src/index.ts'),
            },
        ],
    },
    test: {
        globals: true,
        environment: "node",
        include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    },
});
