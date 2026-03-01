import { defineConfig } from 'tsup'

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    builder: 'src/builder/index.ts',
    tsx: 'src/tsx/index.ts',
    inspector: 'src/inspector/index.ts',
    activity: 'src/activity/index.ts',
    studio: 'src/studio/index.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  sourcemap: true,
  target: 'es2020',
  splitting: true, // Enable splitting to avoid duplicating internal code across both entrypoints
  treeshake: true,
})
