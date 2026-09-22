import { defineConfig } from 'vite'

// Relative base so the built app works at
// https://xiangshu3721.github.io/mindtest-web/beattie/
export default defineConfig({
  base: './',
  build: {
    outDir: '../beattie',
    emptyOutDir: true,
  },
})
