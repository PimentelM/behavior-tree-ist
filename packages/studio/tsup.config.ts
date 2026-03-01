import { defineConfig } from 'tsup'

export default defineConfig({
  outDir: 'dist/server',
  entry: {
    cli: 'src/cli.ts',
  },
  format: ['esm'],
  dts: false,
  clean: true,
  sourcemap: true,
  target: 'node18',
  platform: 'node',
  splitting: false,
  banner: {
    js: '#!/usr/bin/env node',
  },
})
