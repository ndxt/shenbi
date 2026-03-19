import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@shenbi/editor-plugin-api': path.resolve(__dirname, '../api/src/index.ts'),
      '@shenbi/schema': path.resolve(__dirname, '../../schema/types/index.ts'),
    },
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    globals: false,
  },
});
