import { defineConfig, devices } from '@playwright/test';

/**
 * 视觉回归测试 & 契约浏览器验证测试配置
 *
 * 使用方式:
 * - 本地运行：pnpm test:visual
 * - 更新截图：pnpm test:visual:update
 * - 运行单个测试：pnpm test:visual -- --grep "Button"
 * - 只运行契约测试：pnpm test:visual -- --grep "Layer 1"
 * - 只运行视觉测试：pnpm test:visual -- --grep "Visual"
 */
export default defineConfig({
  // 视觉回归测试目录
  testDir: './packages/schema',

  // 测试文件匹配模式
  testMatch: [
    'tests/visual/**/*.test.ts',      // 视觉回归测试
    'contracts/**/contract-browser.test.ts',  // Layer 1 契约浏览器测试
  ],

  // 超时配置
  timeout: 30 * 1000,
  expect: {
    timeout: 5000,
  },

  // 失败重试
  retries: 0,

  // 并行执行
  workers: 1, // 视觉测试需要串行避免资源竞争

  // 报告配置
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['list'],
  ],

  // 共享配置
  use: {
    // 浏览器视口
    viewport: { width: 1200, height: 800 },

    // 设备缩放因子（避免 DPI 差异）
    deviceScaleFactor: 1,

    // 截图配置
    screenshot: 'only-on-failure',

    // 追踪配置
    trace: 'retain-on-failure',

    // 视频配置
    video: 'retain-on-failure',
  },

  // 浏览器配置
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // 固定字体渲染避免差异
        fontFamilies: {
          standard: 'Arial',
          serif: 'Georgia',
          sansSerif: 'Arial',
          monospace: 'Consolas',
        },
      },
    },
  ],

  // Web 服务器配置（用于启动预览服务）
  webServer: {
    command: 'pnpm --filter @shenbi/visual-preview dev',
    url: 'http://localhost:5174',
    reuseExistingServer: true,
    timeout: 60 * 1000,
  },
});
