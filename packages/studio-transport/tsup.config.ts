import { defineConfig } from 'tsup'

export default defineConfig({
    entry: {
        index: 'src/index.ts',
        node: 'src/node/index.ts',
        web: 'src/web/index.ts',
    },
    format: ['esm', 'cjs'],
    dts: true,
    clean: true,
    sourcemap: true,
    target: 'es2020',
    treeshake: true,
    external: ['ws', 'net'],
})
