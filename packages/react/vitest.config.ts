import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  resolve: {
    alias: {
      '@bt-studio/core/inspector': resolve(__dirname, '../core/src/inspector/index.ts'),
      '@bt-studio/core': resolve(__dirname, '../core/src/index.ts'),
    },
  },
  test: {
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    environment: 'jsdom',
    setupFiles: ['src/__tests__/setup.ts'],
    passWithNoTests: true,
  },
})
