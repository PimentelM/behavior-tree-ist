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
                find: '@behavior-tree-ist/core/inspector',
                replacement: fromRoot('../core/src/inspector/index.ts'),
            },
            {
                find: '@behavior-tree-ist/core/demos',
                replacement: fromRoot('../core/src/demos/index.ts'),
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
                find: '@behavior-tree-ist/studio-common',
                replacement: fromRoot('../studio-common/src/index.ts'),
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
        proxy: {
            '/trpc': { target: 'http://localhost:4100', changeOrigin: true },
            '/ui-ws': { target: 'ws://localhost:4100', ws: true },
        },
    },
});
