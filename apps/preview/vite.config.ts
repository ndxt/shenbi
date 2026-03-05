import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@shenbi/schema': path.resolve(__dirname, '../../packages/schema/types/index.ts'),
      '@shenbi/editor-ui': path.resolve(__dirname, '../../packages/editor-ui/src/index.ts'),
    },
  },
});
