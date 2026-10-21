import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  root,
  plugins: [react()],
  build: { outDir: '../dist/web', emptyOutDir: true, sourcemap: false },
  server: { port: 5173, proxy: { '/api': 'http://localhost:8080', '/mock': 'http://localhost:8080' } },
});
