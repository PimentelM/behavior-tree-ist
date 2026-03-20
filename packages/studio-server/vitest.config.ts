import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  resolve: {
    alias: {
      '@bt-studio/core': resolve(__dirname, '../core/src/index.ts'),
      '@bt-studio/studio-common': resolve(__dirname, '../studio-common/src/index.ts'),
      '@bt-studio/studio-transport/node': resolve(__dirname, '../studio-transport/src/node/index.ts'),
      '@bt-studio/studio-transport': resolve(__dirname, '../studio-transport/src/index.ts'),
      '@bt-studio/studio-plugins': resolve(__dirname, '../studio-plugins/src/index.ts'),
    },
  },
  test: {
    include: ['src/**/*.test.ts', 'src/**/*.spec.ts'],
    passWithNoTests: true,
    testTimeout: 15000,
    pool: 'forks',
    fileParallelism: false,
    server: {
      deps: {
        inline: ['knex'],
      },
    },
  },
})
