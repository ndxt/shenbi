import { defineConfig } from '@playwright/test';

const host = process.env.SHENBI_PREVIEW_HOST ?? '127.0.0.1';
const port = Number(process.env.SHENBI_PREVIEW_PORT ?? 4173);
const baseURL = process.env.SHENBI_PREVIEW_BASE_URL ?? `http://${host}:${port}`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  webServer: {
    command: `pnpm run dev --host ${host} --port ${port} --strictPort`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
