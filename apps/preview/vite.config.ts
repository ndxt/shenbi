import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/locode/shenbi/' : '/',
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3100',
        changeOrigin: true,
      },
    },
  },
  appType: 'spa',
  resolve: {
    alias: {
      '@shenbi/ai-contracts': path.resolve(__dirname, '../../packages/ai-contracts/src/index.ts'),
      '@shenbi/editor-core': path.resolve(__dirname, '../../packages/editor-core/src/index.ts'),
      '@shenbi/editor-plugin-api': path.resolve(__dirname, '../../packages/editor-plugins/api/src/index.ts'),
      '@shenbi/editor-plugin-files': path.resolve(__dirname, '../../packages/editor-plugins/files/src/index.ts'),
      '@shenbi/editor-plugin-gitlab-sync': path.resolve(__dirname, '../../packages/editor-plugins/gitlab-sync/src/index.ts'),
      '@shenbi/editor-plugin-setter': path.resolve(__dirname, '../../packages/editor-plugins/setter/src/index.ts'),
      '@shenbi/editor-plugin-ai-chat': path.resolve(__dirname, '../../packages/editor-plugins/ai-chat/src/index.ts'),
      '@shenbi/engine': path.resolve(__dirname, '../../packages/engine/src/index.ts'),
      '@shenbi/i18n': path.resolve(__dirname, '../../packages/i18n/src/index.ts'),
      '@shenbi/schema': path.resolve(__dirname, '../../packages/schema/types/index.ts'),
      '@shenbi/editor-ui': path.resolve(__dirname, '../../packages/editor-ui/src/index.ts'),
      '@shenbi/editor-plugin-gateway': path.resolve(__dirname, '../../packages/editor-plugins/gateway/src/index.ts'),
      '@shenbi/editor-plugin-page-canvas': path.resolve(__dirname, '../../packages/editor-plugins/page-canvas/src/index.ts'),
    },
  },
  build: {
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
        'gateway-debug': path.resolve(__dirname, 'gateway-debug.html'),
      },
    },
  },
}));
