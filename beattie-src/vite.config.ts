import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

const root = path.dirname(fileURLToPath(import.meta.url))

// Relative base so the built app works at
// https://xiangshu3721.github.io/mindtest-web/beattie/
export default defineConfig({
  base: './',
  server: {
    fs: { allow: [path.resolve(root, '..')] },
  },
  build: {
    outDir: '../beattie',
    emptyOutDir: true,
  },
})
