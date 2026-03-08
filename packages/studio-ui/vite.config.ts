import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
const fromRoot = (relativePath: string) => new URL(relativePath, import.meta.url).pathname;

// https://vitejs.dev/config/
export default defineConfig({
    resolve: {
        alias: [
            {
                find: '@bt-studio/react/dist/index.css',
                replacement: fromRoot('../react/src/styles/debugger.css'),
            },
            {
                find: '@bt-studio/core/inspector',
                replacement: fromRoot('../core/src/inspector/index.ts'),
            },
            {
                find: '@bt-studio/core/demos',
                replacement: fromRoot('../core/src/demos/index.ts'),
            },
            {
                find: '@bt-studio/react',
                replacement: fromRoot('../react/src/index.ts'),
            },
            {
                find: '@bt-studio/core',
                replacement: fromRoot('../core/src/index.ts'),
            },
            {
                find: '@bt-studio/studio-common',
                replacement: fromRoot('../studio-common/src/index.ts'),
            },
        ],
    },
    plugins: [
        react(),
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
