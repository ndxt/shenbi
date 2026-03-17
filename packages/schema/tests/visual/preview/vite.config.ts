import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@shenbi/engine': path.resolve(__dirname, '../../../../engine/src'),
      '@shenbi/schema': path.resolve(__dirname, '../../../../schema/src'),
    },
  },
  server: {
    port: 5174,
    strictPort: true,
  },
});
