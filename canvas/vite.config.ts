import { defineConfig } from 'vite'

// The page HTML comes from page.php; this build only produces the script, the styles and the static files.
// Published at /assets/canvas/ (next to the site's own /assets).
export default defineConfig({
  base: '/assets/canvas/',
  build: {
    manifest: true,
    target: 'es2022',
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: { input: 'src/main.ts' },
    // three.js (~145 KB gzip) is its own chunk, loaded after the first paint.
    chunkSizeWarningLimit: 700,
  },
})
