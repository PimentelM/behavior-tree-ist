import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
    resolve: {
        alias: {
            '@bt-studio/core': resolve(__dirname, '../core/src/index.ts'),
            '@bt-studio/studio-common': resolve(__dirname, '../studio-common/src/index.ts'),
            '@bt-studio/studio-plugins': resolve(__dirname, '../studio-plugins/src/index.ts'),
        },
    },
    test: {
        include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
        environment: 'node',
        passWithNoTests: true,
    },
});
