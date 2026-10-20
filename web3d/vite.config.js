import { defineConfig } from 'vite';

// base './' so the build works from any sub-path (e.g. GitHub Pages)
export default defineConfig({
  base: './',
  build: { chunkSizeWarningLimit: 1200 },
});
