import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
    resolve: {
        alias: {
            '@bt-studio/studio-plugins': resolve(__dirname, '../studio-plugins/src/index.ts'),
            '@bt-studio/studio-server': resolve(__dirname, '../studio-server/src/index.ts'),
        },
    },
    test: {
        include: ['src/**/*.test.ts', 'src/**/*.spec.ts'],
        passWithNoTests: true,
    },
});
