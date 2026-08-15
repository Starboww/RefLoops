import { defineConfig } from 'vite';
import { crx } from '@crxjs/vite-plugin';
import react from '@vitejs/plugin-react';
import path from 'path';
import manifest from './manifest.config';

export default defineConfig({
  plugins: [
    react(),
    crx({ manifest }),
  ],
  resolve: {
    alias: {
      '@refloop/core': path.resolve(__dirname, '../core/src/index.ts'),
      '@refloop/storage-chrome': path.resolve(__dirname, '../storage-chrome/src/index.ts'),
      '@refloop/ui': path.resolve(__dirname, '../ui/src/index.ts'),
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    modulePreload: false,
    sourcemap: process.env['NODE_ENV'] !== 'production',
    rollupOptions: {
      input: {
        dashboard: 'src/dashboard/index.html',
        popup: 'src/popup/index.html',
      },
    },
  },
});
