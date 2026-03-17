import { test, expect } from '@playwright/test';
import type { VisualTestCase, VisualTestSuite } from './types';
import { buttonVisualSuite } from './cases/button.visual';
import { inputVisualSuite } from './cases/input.visual';

/**
 * 所有视觉测试套件
 */
const visualTestSuites: VisualTestSuite[] = [
  buttonVisualSuite,
  inputVisualSuite,
];

/**
 * 渲染 Schema 到预览页面的 URL
 *
 * 注意：这是视觉测试的核心依赖，需要一个能渲染 PageSchema 的预览应用。
 * 预览应用需要：
 * 1. 接收 URL 参数中的 schema
 * 2. 使用 @shenbi/engine 的 Renderer 渲染 schema
 * 3. 提供稳定的 CSS 样式（避免动态加载导致差异）
 */
function getPreviewUrl(schema: any): string {
  const schemaJson = encodeURIComponent(JSON.stringify(schema));
  // 使用 URL 参数传递 schema（适合小型 schema）
  return `http://localhost:5174/?schema=${schemaJson}`;
}

/**
 * 视觉回归测试主函数
 */
async function runVisualTest(testCase: VisualTestCase, page: any) {
  const {
    id,
    name,
    schema,
    clip,
    waitFor,
    waitForSelector,
    expectedText,
    expectedStyles,
    diffThreshold = 0.05,
  } = testCase;

  // 1. 导航到预览页面
  await page.goto(getPreviewUrl(schema), { waitUntil: 'networkidle' });

  // 2. 等待组件渲染完成
  if (waitForSelector) {
    await page.waitForSelector(waitForSelector, { state: 'visible' });
  }

  // 3. 额外等待（用于动画完成）
  if (waitFor) {
    await page.waitForTimeout(waitFor);
  }

  // 4. 验证预期文本
  if (expectedText) {
    const body = page.locator('body');
    await expect(body).toContainText(expectedText);
  }

  // 5. 验证预期样式
  if (expectedStyles) {
    const element = await page.locator(waitForSelector || 'body').first();
    for (const [prop, expectedValue] of Object.entries(expectedStyles)) {
      const actualValue = await element.evaluate(
        (el: HTMLElement, p: string) => window.getComputedStyle(el)[p],
        prop
      );
      expect(actualValue).toBe(expectedValue);
    }
  }

  // 6. 截图对比
  const screenshotOptions: any = {
    fullPage: false,
    omitBackground: false,
  };

  if (clip) {
    screenshotOptions.clip = clip;
  }

  const screenshot = await page.screenshot(screenshotOptions);

  // 7. 与基准截图对比（使用 Playwright 内置的 toHaveScreenshot）
  await expect(screenshot).toMatchSnapshot(`${id}.png`, {
    maxDiffPixelRatio: diffThreshold,
  });
}

// ==================== 生成测试用例 ====================

/**
 * 为每个套件生成 Playwright 测试
 */
for (const suite of visualTestSuites) {
  test.describe(`Visual: ${suite.name}`, () => {
    for (const testCase of suite.cases) {
      const testFn = testCase.only ? test.only : testCase.skip ? test.skip : test;

      testFn(testCase.name, async ({ page }) => {
        await runVisualTest(testCase, page);
      });
    }
  });
}

// ==================== 快速单个测试示例 ====================

test.describe('Quick Visual Tests', () => {
  test('Button - Primary should render correctly', async ({ page }) => {
    const schema = {
      body: [{
        id: 'btn-test',
        component: 'Button',
        props: { type: 'primary', children: '测试按钮' },
      }],
    };

    await page.goto(getPreviewUrl(schema), { waitUntil: 'networkidle' });
    await page.waitForSelector('.ant-btn-primary');

    await expect(page).toHaveScreenshot('button-primary-quick.png', {
      maxDiffPixelRatio: 0.05,
    });
  });

  test('Input - Basic should render correctly', async ({ page }) => {
    const schema = {
      body: [{
        id: 'input-test',
        component: 'Input',
        props: { placeholder: '测试输入框' },
      }],
    };

    await page.goto(getPreviewUrl(schema), { waitUntil: 'networkidle' });
    await page.waitForSelector('.ant-input');

    await expect(page).toHaveScreenshot('input-basic-quick.png', {
      maxDiffPixelRatio: 0.05,
    });
  });
});
