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
      '@shenbi/editor-core': path.resolve(__dirname, '../../packages/editor-core/src/index.ts'),
      '@shenbi/editor-plugin-api': path.resolve(__dirname, '../../packages/editor-plugins/api/src/index.ts'),
      '@shenbi/editor-plugin-files': path.resolve(__dirname, '../../packages/editor-plugins/files/src/index.ts'),
      '@shenbi/editor-plugin-setter': path.resolve(__dirname, '../../packages/editor-plugins/setter/src/index.ts'),
      '@shenbi/editor-plugin-ai-chat': path.resolve(__dirname, '../../packages/editor-plugins/ai-chat/src/index.ts'),
      '@shenbi/schema': path.resolve(__dirname, '../../packages/schema/types/index.ts'),
      '@shenbi/editor-ui': path.resolve(__dirname, '../../packages/editor-ui/src/index.ts'),
    },
  },
});
