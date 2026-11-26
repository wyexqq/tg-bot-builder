import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const removeCrossorigin = {
  name: 'remove-crossorigin',
  transformIndexHtml(html) {
    return html.replace(/ crossorigin/g, '');
  },
};

export default defineConfig({
  plugins: [react(), removeCrossorigin],
  base: './',
  server: {
    port: 5173,
    strictPort: true,
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      external: ['electron'],
    },
  },
});
