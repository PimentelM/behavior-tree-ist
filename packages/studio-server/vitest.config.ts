import { defineConfig } from 'vitest/config'

export default defineConfig({
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
