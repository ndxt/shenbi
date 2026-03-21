import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@shenbi/editor-core': path.resolve(__dirname, '../../editor-core/src/index.ts'),
      '@shenbi/editor-plugin-api': path.resolve(__dirname, '../api/src/index.ts'),
      '@shenbi/editor-plugin-files': path.resolve(__dirname, '../files/src/index.ts'),
      '@shenbi/editor-plugin-setter': path.resolve(__dirname, '../setter/src/index.ts'),
      '@shenbi/editor-plugin-ai-chat': path.resolve(__dirname, '../ai-chat/src/index.ts'),
      '@shenbi/editor-ui': path.resolve(__dirname, '../../editor-ui/src/index.ts'),
      '@shenbi/i18n': path.resolve(__dirname, '../../i18n/src/index.ts'),
      '@shenbi/schema': path.resolve(__dirname, '../../schema/types/index.ts'),
    },
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    globals: false,
  },
});
