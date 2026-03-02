import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { ReactMcp } from '@dogtiti/vite-plugin-react-mcp';

const fromRoot = (relativePath: string) => new URL(relativePath, import.meta.url).pathname;

// https://vitejs.dev/config/
export default defineConfig({
    resolve: {
        alias: [
            {
                find: '@behavior-tree-ist/react/dist/index.css',
                replacement: fromRoot('../react/src/styles/debugger.css'),
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
                find: '@behavior-tree-ist/react',
                replacement: fromRoot('../react/src/index.ts'),
            },
            {
                find: '@behavior-tree-ist/core',
                replacement: fromRoot('../core/src/index.ts'),
            },
            {
                find: '@behavior-tree-ist/studio-transport',
                replacement: fromRoot('../studio-transport/src/index.ts'),
            },
        ],
    },
    plugins: [
        react(),
        ReactMcp(),
    ],
    server: {
        port: 3000,
        host: true,
    },
});
