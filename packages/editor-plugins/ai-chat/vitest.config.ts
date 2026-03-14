import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@shenbi/editor-core': path.resolve(__dirname, '../../editor-core/src/index.ts'),
      '@shenbi/editor-plugin-api': path.resolve(__dirname, '../api/src/index.ts'),
      '@shenbi/schema': path.resolve(__dirname, '../../schema/types/index.ts'),
      '@shenbi/i18n': path.resolve(__dirname, '../../i18n/src/index.ts'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
});
