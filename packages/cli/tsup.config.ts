import { defineConfig } from 'tsup'

export default defineConfig({
  entry: {
    index: 'src/index.ts',
  },
  format: ['esm'],
  dts: false,
  clean: true,
  sourcemap: true,
  target: 'es2020',
  platform: 'node',
  splitting: false,
  treeshake: true,
  banner: {
    js: '#!/usr/bin/env node',
  },
})
