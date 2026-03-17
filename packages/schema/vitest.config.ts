import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: [
      'contracts/**/*.test.ts',
      'contracts/**/*.test.tsx',
      'tests/**/*.test.ts',
    ],
    exclude: [
      'contracts/contract-browser.test.ts',
      'tests/visual/**/*.test.ts',
    ],
  },
});
