import { defineConfig } from 'tsup'

export default defineConfig({
    entry: {
        index: 'src/cli/index.ts',
    },
    outDir: 'dist/cli',
    format: ['esm'],
    clean: false, // don't wipe the vite dist
    sourcemap: true,
    target: 'node18',
    noExternal: [], // keep workspace deps external (resolved at runtime)
})
