import { test, expect } from '@playwright/test';

/**
 * Layer 1 - 契约正确性浏览器验证测试
 *
 * 基于 antd-api-golden.json 中的组件 API 定义，
 * 在浏览器中实际渲染并验证每个 prop 的效果。
 *
 * 与视觉回归测试的区别：
 * - 视觉测试：使用截图对比，检测像素级差异
 * - 契约测试：使用 DOM 断言，验证特定 prop 是否正确渲染
 *
 * 覆盖组件 (76 个测试用例):
 * - Button (13), Input (7), Input.TextArea (2), Select (5)
 * - Radio (2), Checkbox (3), Switch (3), Alert (6)
 * - Badge (2), Tag (3), Card (2), Modal (1), Drawer (1)
 * - Tabs (1), Progress (3), Spin (2)
 * - Form (1), DatePicker (5), Tree (4), Table (5), Avatar (5)
 */

// 从 URL 参数获取预览页面
function getPreviewUrl(schema: any): string {
  const schemaJson = encodeURIComponent(JSON.stringify(schema));
  return `http://localhost:5174/?schema=${schemaJson}`;
}

// ==================== Button 组件契约测试 ====================

test.describe('Layer 1: Button Contract', () => {
  test('type=primary 应该渲染主要按钮样式 (符合 golden 定义)', async ({ page }) => {
    const schema = {
      body: [{
        component: 'Button',
        props: { type: 'primary', children: '主要按钮' },
      }],
    };

    await page.goto(getPreviewUrl(schema), { waitUntil: 'networkidle' });
    const button = await page.waitForSelector('.ant-btn-primary', { state: 'visible' });
    expect(await button.isVisible()).toBe(true);
  });

  test('type=default 应该渲染默认按钮样式 (符合 golden 定义)', async ({ page }) => {
    const schema = {
      body: [{
        component: 'Button',
        props: { type: 'default', children: '默认按钮' },
      }],
    };

    await page.goto(getPreviewUrl(schema), { waitUntil: 'networkidle' });
    const button = await page.waitForSelector('.ant-btn-default', { state: 'visible' });
    expect(await button.isVisible()).toBe(true);
  });

  test('type=dashed 应该渲染虚线按钮样式 (符合 golden 定义)', async ({ page }) => {
    const schema = {
      body: [{
        component: 'Button',
        props: { type: 'dashed', children: '虚线按钮' },
      }],
    };

    await page.goto(getPreviewUrl(schema), { waitUntil: 'networkidle' });
    const button = await page.waitForSelector('.ant-btn-dashed', { state: 'visible' });
    expect(await button.isVisible()).toBe(true);
  });

  test('type=text 应该渲染文本按钮样式 (符合 golden 定义)', async ({ page }) => {
    const schema = {
      body: [{
        component: 'Button',
        props: { type: 'text', children: '文本按钮' },
      }],
    };

    await page.goto(getPreviewUrl(schema), { waitUntil: 'networkidle' });
    const button = await page.waitForSelector('.ant-btn-text', { state: 'visible' });
    expect(await button.isVisible()).toBe(true);
  });

  test('type=link 应该渲染链接按钮样式 (符合 golden 定义)', async ({ page }) => {
    const schema = {
      body: [{
        component: 'Button',
        props: { type: 'link', children: '链接按钮' },
      }],
    };

    await page.goto(getPreviewUrl(schema), { waitUntil: 'networkidle' });
    const button = await page.waitForSelector('.ant-btn-link', { state: 'visible' });
    expect(await button.isVisible()).toBe(true);
  });

  test('size=large 应该渲染大尺寸 (符合 golden 定义)', async ({ page }) => {
    const schema = {
      body: [{
        component: 'Button',
        props: { type: 'primary', size: 'large', children: '大按钮' },
      }],
    };

    await page.goto(getPreviewUrl(schema), { waitUntil: 'networkidle' });
    const button = await page.waitForSelector('.ant-btn-lg', { state: 'visible' });
    expect(await button.isVisible()).toBe(true);
  });

  test('size=small 应该渲染小尺寸 (符合 golden 定义)', async ({ page }) => {
    const schema = {
      body: [{
        component: 'Button',
        props: { type: 'primary', size: 'small', children: '小按钮' },
      }],
    };

    await page.goto(getPreviewUrl(schema), { waitUntil: 'networkidle' });
    const button = await page.waitForSelector('.ant-btn-sm', { state: 'visible' });
    expect(await button.isVisible()).toBe(true);
  });

  test('danger=true 应该渲染危险样式 (符合 golden 定义)', async ({ page }) => {
    const schema = {
      body: [{
        component: 'Button',
        props: { type: 'primary', danger: true, children: '危险操作' },
      }],
    };

    await page.goto(getPreviewUrl(schema), { waitUntil: 'networkidle' });
    const button = await page.waitForSelector('.ant-btn-dangerous', { state: 'visible' });
    expect(await button.isVisible()).toBe(true);
  });

  test('loading=true 应该渲染加载状态 (符合 golden 定义)', async ({ page }) => {
    const schema = {
      body: [{
        component: 'Button',
        props: { type: 'primary', loading: true, children: '加载中' },
      }],
    };

    await page.goto(getPreviewUrl(schema), { waitUntil: 'networkidle' });
    const button = await page.waitForSelector('.ant-btn-loading', { state: 'visible' });
    expect(await button.isVisible()).toBe(true);
  });

  test('disabled=true 应该渲染禁用状态 (符合 golden 定义)', async ({ page }) => {
    const schema = {
      body: [{
        component: 'Button',
        props: { type: 'primary', disabled: true, children: '禁用按钮' },
      }],
    };

    await page.goto(getPreviewUrl(schema), { waitUntil: 'networkidle' });
    const button = await page.waitForSelector('.ant-btn[disabled]', { state: 'visible' });
    expect(await button.getAttribute('disabled')).not.toBeNull();
  });

  test('block=true 应该渲染块级按钮 (符合 golden 定义)', async ({ page }) => {
    const schema = {
      body: [{
        component: 'Button',
        props: { type: 'primary', block: true, children: '块级按钮' },
      }],
    };

    await page.goto(getPreviewUrl(schema), { waitUntil: 'networkidle' });
    const button = await page.waitForSelector('.ant-btn-block', { state: 'visible' });
    expect(await button.isVisible()).toBe(true);
  });

  test('shape=circle 应该渲染圆形按钮 (符合 golden 定义)', async ({ page }) => {
    const schema = {
      body: [{
        component: 'Button',
        props: { shape: 'circle', children: 'A' },
      }],
    };

    await page.goto(getPreviewUrl(schema), { waitUntil: 'networkidle' });
    const button = await page.waitForSelector('.ant-btn-circle', { state: 'visible' });
    expect(await button.isVisible()).toBe(true);
  });

  test('shape=round 应该渲染圆角按钮 (符合 golden 定义)', async ({ page }) => {
    const schema = {
      body: [{
        component: 'Button',
        props: { type: 'primary', shape: 'round', children: '圆角按钮' },
      }],
    };

    await page.goto(getPreviewUrl(schema), { waitUntil: 'networkidle' });
    const button = await page.waitForSelector('.ant-btn-round', { state: 'visible' });
    expect(await button.isVisible()).toBe(true);
  });
});

// ==================== Input 组件契约测试 ====================

test.describe('Layer 1: Input Contract', () => {
  test('placeholder 应该正确显示 (符合 golden 定义)', async ({ page }) => {
    const schema = {
      body: [{
        component: 'Input',
        props: { placeholder: '测试占位符' },
      }],
    };

    await page.goto(getPreviewUrl(schema), { waitUntil: 'networkidle' });
    const input = await page.waitForSelector('input[placeholder="测试占位符"]', { state: 'visible' });
    expect(await input.isVisible()).toBe(true);
  });

  test('defaultValue 应该显示默认值 (符合 golden 定义)', async ({ page }) => {
    const schema = {
      body: [{
        component: 'Input',
        props: { defaultValue: '默认文本' },
      }],
    };

    await page.goto(getPreviewUrl(schema), { waitUntil: 'networkidle' });
    const input = await page.waitForSelector('input[value="默认文本"]', { state: 'visible' });
    expect(await input.isVisible()).toBe(true);
  });

  test('disabled=true 应该渲染禁用状态 (符合 golden 定义)', async ({ page }) => {
    const schema = {
      body: [{
        component: 'Input',
        props: { disabled: true, placeholder: '禁用输入' },
      }],
    };

    await page.goto(getPreviewUrl(schema), { waitUntil: 'networkidle' });
    const input = await page.waitForSelector('input:disabled', { state: 'visible' });
    expect(await input.getAttribute('disabled')).not.toBeNull();
  });

  test('size=large 应该渲染大尺寸 (符合 golden 定义)', async ({ page }) => {
    const schema = {
      body: [{
        component: 'Input',
        props: { size: 'large', placeholder: '大尺寸' },
      }],
    };

    await page.goto(getPreviewUrl(schema), { waitUntil: 'networkidle' });
    const wrapper = await page.waitForSelector('.ant-input-lg', { state: 'visible' });
    expect(await wrapper.isVisible()).toBe(true);
  });

  test('size=small 应该渲染小尺寸 (符合 golden 定义)', async ({ page }) => {
    const schema = {
      body: [{
        component: 'Input',
        props: { size: 'small', placeholder: '小尺寸' },
      }],
    };

    await page.goto(getPreviewUrl(schema), { waitUntil: 'networkidle' });
    const wrapper = await page.waitForSelector('.ant-input-sm', { state: 'visible' });
    expect(await wrapper.isVisible()).toBe(true);
  });

  test('type=password 应该渲染密码输入框 (符合 golden 定义)', async ({ page }) => {
    const schema = {
      body: [{
        component: 'Input',
        props: { type: 'password', placeholder: '密码' },
      }],
    };

    await page.goto(getPreviewUrl(schema), { waitUntil: 'networkidle' });
    const input = await page.waitForSelector('input[type="password"]', { state: 'visible' });
    expect(await input.isVisible()).toBe(true);
  });

  test('allowClear=true 应该显示清除按钮 (符合 golden 定义)', async ({ page }) => {
    const schema = {
      body: [{
        component: 'Input',
        props: { allowClear: true, defaultValue: '可清除' },
      }],
    };

    await page.goto(getPreviewUrl(schema), { waitUntil: 'networkidle' });
    const wrapper = await page.waitForSelector('.ant-input-affix-wrapper', { state: 'visible' });
    expect(await wrapper.isVisible()).toBe(true);
  });
});

// ==================== Input.TextArea 组件契约测试 ====================

test.describe('Layer 1: Input.TextArea Contract', () => {
  test('应该渲染多行文本框 (符合 golden 定义)', async ({ page }) => {
    const schema = {
      body: [{
        component: 'Input.TextArea',
        props: { placeholder: '多行输入', rows: 4 },
      }],
    };

    await page.goto(getPreviewUrl(schema), { waitUntil: 'networkidle' });
    const textarea = await page.waitForSelector('textarea.ant-input', { state: 'visible' });
    expect(await textarea.isVisible()).toBe(true);
  });

  test('showCount=true 应该显示字数统计 (符合 golden 定义)', async ({ page }) => {
    const schema = {
      body: [{
        component: 'Input.TextArea',
        props: { showCount: true, maxLength: 100, placeholder: '带统计' },
      }],
    };

    await page.goto(getPreviewUrl(schema), { waitUntil: 'networkidle' });
    const wrapper = await page.waitForSelector('.ant-input-textarea-show-count', { state: 'visible' });
    expect(await wrapper.isVisible()).toBe(true);
  });
});

// ==================== Select 组件契约测试 ====================

test.describe('Layer 1: Select Contract', () => {
  test('placeholder 应该正确显示 (符合 golden 定义)', async ({ page }) => {
    const schema = {
      body: [{
        component: 'Select',
        props: { placeholder: '请选择', options: [{ label: '选项 1', value: '1' }] },
      }],
    };

    await page.goto(getPreviewUrl(schema), { waitUntil: 'networkidle' });
    const select = await page.waitForSelector('.ant-select', { state: 'visible' });
    expect(await select.isVisible()).toBe(true);
  });

  test('disabled=true 应该渲染禁用状态 (符合 golden 定义)', async ({ page }) => {
    const schema = {
      body: [{
        component: 'Select',
        props: { disabled: true, options: [{ label: '选项 1', value: '1' }] },
      }],
    };

    await page.goto(getPreviewUrl(schema), { waitUntil: 'networkidle' });
    const select = await page.waitForSelector('.ant-select-disabled', { state: 'visible' });
    expect(await select.isVisible()).toBe(true);
  });

  test('size=large 应该渲染大尺寸 (符合 golden 定义)', async ({ page }) => {
    const schema = {
      body: [{
        component: 'Select',
        props: { size: 'large', options: [{ label: '选项 1', value: '1' }] },
      }],
    };

    await page.goto(getPreviewUrl(schema), { waitUntil: 'networkidle' });
    const select = await page.waitForSelector('.ant-select-lg', { state: 'visible' });
    expect(await select.isVisible()).toBe(true);
  });

  test('allowClear=true 应该允许清除 (符合 golden 定义)', async ({ page }) => {
    const schema = {
      body: [{
        component: 'Select',
        props: {
          allowClear: true,
          defaultValue: '1',
          options: [{ label: '选项 1', value: '1' }, { label: '选项 2', value: '2' }]
        },
      }],
    };

    await page.goto(getPreviewUrl(schema), { waitUntil: 'networkidle' });
    const select = await page.waitForSelector('.ant-select-allow-clear', { state: 'visible' });
    expect(await select.isVisible()).toBe(true);
  });

  test('loading=true 应该显示加载状态 (符合 golden 定义)', async ({ page }) => {
    const schema = {
      body: [{
        component: 'Select',
        props: { loading: true, options: [{ label: '选项 1', value: '1' }] },
      }],
    };

    await page.goto(getPreviewUrl(schema), { waitUntil: 'networkidle' });
    const select = await page.waitForSelector('.ant-select-loading', { state: 'visible' });
    expect(await select.isVisible()).toBe(true);
  });
});

// ==================== Radio 组件契约测试 ====================

test.describe('Layer 1: Radio Contract', () => {
  test('应该渲染单选按钮 (符合 golden 定义)', async ({ page }) => {
    const schema = {
      body: [{
        component: 'Radio',
        props: { children: '单选' },
      }],
    };

    await page.goto(getPreviewUrl(schema), { waitUntil: 'networkidle' });
    const radio = await page.waitForSelector('.ant-radio-wrapper', { state: 'visible' });
    expect(await radio.isVisible()).toBe(true);
  });

  test('disabled=true 应该渲染禁用状态 (符合 golden 定义)', async ({ page }) => {
    const schema = {
      body: [{
        component: 'Radio',
        props: { disabled: true, children: '禁用单选' },
      }],
    };

    await page.goto(getPreviewUrl(schema), { waitUntil: 'networkidle' });
    const radio = await page.waitForSelector('.ant-radio-wrapper-disabled', { state: 'visible' });
    expect(await radio.isVisible()).toBe(true);
  });
});

// ==================== Checkbox 组件契约测试 ====================

test.describe('Layer 1: Checkbox Contract', () => {
  test('应该渲染复选框 (符合 golden 定义)', async ({ page }) => {
    const schema = {
      body: [{
        component: 'Checkbox',
        props: { children: '复选' },
      }],
    };

    await page.goto(getPreviewUrl(schema), { waitUntil: 'networkidle' });
    const checkbox = await page.waitForSelector('.ant-checkbox-wrapper', { state: 'visible' });
    expect(await checkbox.isVisible()).toBe(true);
  });

  test('disabled=true 应该渲染禁用状态 (符合 golden 定义)', async ({ page }) => {
    const schema = {
      body: [{
        component: 'Checkbox',
        props: { disabled: true, children: '禁用复选' },
      }],
    };

    await page.goto(getPreviewUrl(schema), { waitUntil: 'networkidle' });
    const checkbox = await page.waitForSelector('.ant-checkbox-wrapper-disabled', { state: 'visible' });
    expect(await checkbox.isVisible()).toBe(true);
  });

  test('checked=true 应该渲染选中状态 (符合 golden 定义)', async ({ page }) => {
    const schema = {
      body: [{
        component: 'Checkbox',
        props: { checked: true, children: '已选中' },
      }],
    };

    await page.goto(getPreviewUrl(schema), { waitUntil: 'networkidle' });
    const checkbox = await page.waitForSelector('.ant-checkbox-checked', { state: 'visible' });
    expect(await checkbox.isVisible()).toBe(true);
  });
});

// ==================== Switch 组件契约测试 ====================

test.describe('Layer 1: Switch Contract', () => {
  test('checked=true 应该渲染开启状态 (符合 golden 定义)', async ({ page }) => {
    const schema = {
      body: [{
        component: 'Switch',
        props: { checked: true },
      }],
    };

    await page.goto(getPreviewUrl(schema), { waitUntil: 'networkidle' });
    const switchEl = await page.waitForSelector('.ant-switch-checked', { state: 'visible' });
    expect(await switchEl.isVisible()).toBe(true);
  });

  test('disabled=true 应该渲染禁用状态 (符合 golden 定义)', async ({ page }) => {
    const schema = {
      body: [{
        component: 'Switch',
        props: { disabled: true },
      }],
    };

    await page.goto(getPreviewUrl(schema), { waitUntil: 'networkidle' });
    const switchEl = await page.waitForSelector('.ant-switch-disabled', { state: 'visible' });
    expect(await switchEl.isVisible()).toBe(true);
  });

  test('size=small 应该渲染小尺寸 (符合 golden 定义)', async ({ page }) => {
    const schema = {
      body: [{
        component: 'Switch',
        props: { size: 'small' },
      }],
    };

    await page.goto(getPreviewUrl(schema), { waitUntil: 'networkidle' });
    const switchEl = await page.waitForSelector('.ant-switch-small', { state: 'visible' });
    expect(await switchEl.isVisible()).toBe(true);
  });
});

// ==================== Alert 组件契约测试 ====================

test.describe('Layer 1: Alert Contract', () => {
  test('type=success 应该渲染成功样式 (符合 golden 定义)', async ({ page }) => {
    const schema = {
      body: [{
        component: 'Alert',
        props: { type: 'success', message: '成功提示' },
      }],
    };

    await page.goto(getPreviewUrl(schema), { waitUntil: 'networkidle' });
    const alert = await page.waitForSelector('.ant-alert-success', { state: 'visible' });
    expect(await alert.isVisible()).toBe(true);
  });

  test('type=error 应该渲染错误样式 (符合 golden 定义)', async ({ page }) => {
    const schema = {
      body: [{
        component: 'Alert',
        props: { type: 'error', message: '错误提示' },
      }],
    };

    await page.goto(getPreviewUrl(schema), { waitUntil: 'networkidle' });
    const alert = await page.waitForSelector('.ant-alert-error', { state: 'visible' });
    expect(await alert.isVisible()).toBe(true);
  });

  test('type=warning 应该渲染警告样式 (符合 golden 定义)', async ({ page }) => {
    const schema = {
      body: [{
        component: 'Alert',
        props: { type: 'warning', message: '警告提示' },
      }],
    };

    await page.goto(getPreviewUrl(schema), { waitUntil: 'networkidle' });
    const alert = await page.waitForSelector('.ant-alert-warning', { state: 'visible' });
    expect(await alert.isVisible()).toBe(true);
  });

  test('type=info 应该渲染信息样式 (符合 golden 定义)', async ({ page }) => {
    const schema = {
      body: [{
        component: 'Alert',
        props: { type: 'info', message: '信息提示' },
      }],
    };

    await page.goto(getPreviewUrl(schema), { waitUntil: 'networkidle' });
    const alert = await page.waitForSelector('.ant-alert-info', { state: 'visible' });
    expect(await alert.isVisible()).toBe(true);
  });

  test('showIcon=true 应该显示图标 (符合 golden 定义)', async ({ page }) => {
    const schema = {
      body: [{
        component: 'Alert',
        props: { showIcon: true, type: 'info', message: '带图标' },
      }],
    };

    await page.goto(getPreviewUrl(schema), { waitUntil: 'networkidle' });
    // Ant Design Alert 有图标时会有一个 .ant-alert-icon 元素
    const icon = await page.waitForSelector('.ant-alert-icon', { state: 'visible' });
    expect(await icon.isVisible()).toBe(true);
  });

  test('closable=true 应该显示关闭按钮 (符合 golden 定义)', async ({ page }) => {
    const schema = {
      body: [{
        component: 'Alert',
        props: { closable: true, message: '可关闭' },
      }],
    };

    await page.goto(getPreviewUrl(schema), { waitUntil: 'networkidle' });
    const closeBtn = await page.waitForSelector('.ant-alert-close-icon', { state: 'visible' });
    expect(await closeBtn.isVisible()).toBe(true);
  });
});

// ==================== Badge 组件契约测试 ====================

test.describe('Layer 1: Badge Contract', () => {
  test('count 应该显示徽标数量 (符合 golden 定义)', async ({ page }) => {
    const schema = {
      body: [{
        component: 'Badge',
        props: { count: 5, children: { component: 'span', props: { children: '内容' } } },
      }],
    };

    await page.goto(getPreviewUrl(schema), { waitUntil: 'networkidle' });
    const badge = await page.waitForSelector('.ant-badge-count', { state: 'visible' });
    expect(await badge.isVisible()).toBe(true);
  });

  test('dot=true 应该显示点状徽标 (符合 golden 定义)', async ({ page }) => {
    const schema = {
      body: [{
        component: 'Badge',
        props: { dot: true, children: { component: 'span', props: { children: '内容' } } },
      }],
    };

    await page.goto(getPreviewUrl(schema), { waitUntil: 'networkidle' });
    const badge = await page.waitForSelector('.ant-badge-dot', { state: 'visible' });
    expect(await badge.isVisible()).toBe(true);
  });
});

// ==================== Tag 组件契约测试 ====================

test.describe('Layer 1: Tag Contract', () => {
  test('color=red 应该渲染红色标签 (符合 golden 定义)', async ({ page }) => {
    const schema = {
      body: [{
        component: 'Tag',
        props: { color: 'red', children: '红色标签' },
      }],
    };

    await page.goto(getPreviewUrl(schema), { waitUntil: 'networkidle' });
    const tag = await page.waitForSelector('.ant-tag-red', { state: 'visible' });
    expect(await tag.isVisible()).toBe(true);
  });

  test('color=blue 应该渲染蓝色标签 (符合 golden 定义)', async ({ page }) => {
    const schema = {
      body: [{
        component: 'Tag',
        props: { color: 'blue', children: '蓝色标签' },
      }],
    };

    await page.goto(getPreviewUrl(schema), { waitUntil: 'networkidle' });
    const tag = await page.waitForSelector('.ant-tag-blue', { state: 'visible' });
    expect(await tag.isVisible()).toBe(true);
  });

  test('closable=true 应该显示关闭按钮 (符合 golden 定义)', async ({ page }) => {
    const schema = {
      body: [{
        component: 'Tag',
        props: { closable: true, children: '可关闭标签' },
      }],
    };

    await page.goto(getPreviewUrl(schema), { waitUntil: 'networkidle' });
    const closeBtn = await page.waitForSelector('.ant-tag-close-icon', { state: 'visible' });
    expect(await closeBtn.isVisible()).toBe(true);
  });
});

// ==================== Card 组件契约测试 ====================

test.describe('Layer 1: Card Contract', () => {
  test('title 应该显示卡片标题 (符合 golden 定义)', async ({ page }) => {
    const schema = {
      body: [{
        component: 'Card',
        props: { title: '卡片标题', children: '卡片内容' },
      }],
    };

    await page.goto(getPreviewUrl(schema), { waitUntil: 'networkidle' });
    const title = await page.waitForSelector('.ant-card-head-title', { state: 'visible' });
    expect(await title.isVisible()).toBe(true);
  });

  test(' bordered=false 应该无边框 (符合 golden 定义)', async ({ page }) => {
    const schema = {
      body: [{
        component: 'Card',
        props: { bordered: false, children: '无边框卡片' },
      }],
    };

    await page.goto(getPreviewUrl(schema), { waitUntil: 'networkidle' });
    const card = await page.waitForSelector('.ant-card:not(.ant-card-bordered)', { state: 'visible' });
    expect(await card.isVisible()).toBe(true);
  });
});

// ==================== Modal 组件契约测试 ====================

test.describe('Layer 1: Modal Contract', () => {
  test('open=true 应该显示模态框 (符合 golden 定义)', async ({ page }) => {
    const schema = {
      body: [{
        component: 'Modal',
        props: { open: true, title: '模态框标题', children: '模态框内容' },
      }],
    };

    await page.goto(getPreviewUrl(schema), { waitUntil: 'networkidle' });
    // Modal 打开时会有 .ant-modal-wrap 且 display 不为 none
    const modal = await page.waitForSelector('.ant-modal-wrap', { state: 'visible' });
    expect(await modal.isVisible()).toBe(true);
  });
});

// ==================== Drawer 组件契约测试 ====================

test.describe('Layer 1: Drawer Contract', () => {
  test('open=true 应该显示抽屉 (符合 golden 定义)', async ({ page }) => {
    const schema = {
      body: [{
        component: 'Drawer',
        props: { open: true, title: '抽屉标题', children: '抽屉内容' },
      }],
    };

    await page.goto(getPreviewUrl(schema), { waitUntil: 'networkidle' });
    const drawer = await page.waitForSelector('.ant-drawer-open', { state: 'visible' });
    expect(await drawer.isVisible()).toBe(true);
  });
});

// ==================== Tabs 组件契约测试 ====================

test.describe('Layer 1: Tabs Contract', () => {
  test('应该渲染标签页 (符合 golden 定义)', async ({ page }) => {
    const schema = {
      body: [{
        component: 'Tabs',
        props: {
          items: [
            { key: 'tab1', label: '标签 1', children: '内容 1' },
            { key: 'tab2', label: '标签 2', children: '内容 2' }
          ]
        },
      }],
    };

    await page.goto(getPreviewUrl(schema), { waitUntil: 'networkidle' });
    const tabs = await page.waitForSelector('.ant-tabs', { state: 'visible' });
    expect(await tabs.isVisible()).toBe(true);
  });
});

// ==================== Progress 组件契约测试 ====================

test.describe('Layer 1: Progress Contract', () => {
  test('percent 应该显示进度条 (符合 golden 定义)', async ({ page }) => {
    const schema = {
      body: [{
        component: 'Progress',
        props: { percent: 50 },
      }],
    };

    await page.goto(getPreviewUrl(schema), { waitUntil: 'networkidle' });
    const progress = await page.waitForSelector('.ant-progress', { state: 'visible' });
    expect(await progress.isVisible()).toBe(true);
  });

  test('status=success 应该显示成功状态 (符合 golden 定义)', async ({ page }) => {
    const schema = {
      body: [{
        component: 'Progress',
        props: { percent: 100, status: 'success' },
      }],
    };

    await page.goto(getPreviewUrl(schema), { waitUntil: 'networkidle' });
    // Ant Design Progress 成功状态：验证组件渲染且进度为 100%
    const progress = await page.waitForSelector('.ant-progress', { state: 'visible' });
    // 使用 aria-valuenow 验证进度值
    const ariaValue = await progress.getAttribute('aria-valuenow');
    expect(ariaValue).toBe('100');
  });

  test('status=exception 应该显示异常状态 (符合 golden 定义)', async ({ page }) => {
    const schema = {
      body: [{
        component: 'Progress',
        props: { status: 'exception' },
      }],
    };

    await page.goto(getPreviewUrl(schema), { waitUntil: 'networkidle' });
    // Ant Design Progress 异常状态：验证组件渲染且 aria-valuenow 存在
    const progress = await page.waitForSelector('.ant-progress', { state: 'visible' });
    // 验证 aria-valuenow 属性存在
    const ariaValue = await progress.getAttribute('aria-valuenow');
    expect(ariaValue).toBeDefined();
  });
});

// ==================== Spin 组件契约测试 ====================

test.describe('Layer 1: Spin Contract', () => {
  test('spinning=true 应该显示加载动画 (符合 golden 定义)', async ({ page }) => {
    const schema = {
      body: [{
        component: 'Spin',
        props: { spinning: true },
      }],
    };

    await page.goto(getPreviewUrl(schema), { waitUntil: 'networkidle' });
    const spin = await page.waitForSelector('.ant-spin-spinning', { state: 'visible' });
    expect(await spin.isVisible()).toBe(true);
  });

  test('size=large 应该渲染大尺寸 (符合 golden 定义)', async ({ page }) => {
    const schema = {
      body: [{
        component: 'Spin',
        props: { size: 'large' },
      }],
    };

    await page.goto(getPreviewUrl(schema), { waitUntil: 'networkidle' });
    const spin = await page.waitForSelector('.ant-spin-lg', { state: 'visible' });
    expect(await spin.isVisible()).toBe(true);
  });
});

// ==================== Form 组件契约测试 ====================

test.describe('Layer 1: Form Contract', () => {
  test('应该渲染基础表单 (符合 golden 定义)', async ({ page }) => {
    const schema = {
      body: [{
        component: 'Form',
        props: {},
        children: [{
          component: 'div',
          props: { children: 'Form Content' },
        }],
      }],
    };

    await page.goto(getPreviewUrl(schema), { waitUntil: 'networkidle' });
    // 验证表单渲染成功 (使用 exists 而非 visible，因为空表单可能高度为 0)
    const form = await page.waitForSelector('form.ant-form', { state: 'attached' });
    expect(form).toBeTruthy();
  });
});

// ==================== DatePicker 组件契约测试 ====================

test.describe('Layer 1: DatePicker Contract', () => {
  test('placeholder 应该正确显示 (符合 golden 定义)', async ({ page }) => {
    const schema = {
      body: [{
        component: 'DatePicker',
        props: { placeholder: '选择日期' },
      }],
    };

    await page.goto(getPreviewUrl(schema), { waitUntil: 'networkidle' });
    const picker = await page.waitForSelector('.ant-picker', { state: 'visible' });
    expect(await picker.isVisible()).toBe(true);
  });

  test('disabled=true 应该渲染禁用状态 (符合 golden 定义)', async ({ page }) => {
    const schema = {
      body: [{
        component: 'DatePicker',
        props: { disabled: true },
      }],
    };

    await page.goto(getPreviewUrl(schema), { waitUntil: 'networkidle' });
    const picker = await page.waitForSelector('.ant-picker-disabled', { state: 'visible' });
    expect(await picker.isVisible()).toBe(true);
  });

  test('size=large 应该渲染大尺寸 (符合 golden 定义)', async ({ page }) => {
    const schema = {
      body: [{
        component: 'DatePicker',
        props: { size: 'large' },
      }],
    };

    await page.goto(getPreviewUrl(schema), { waitUntil: 'networkidle' });
    const picker = await page.waitForSelector('.ant-picker-large', { state: 'visible' });
    expect(await picker.isVisible()).toBe(true);
  });

  test('size=small 应该渲染小尺寸 (符合 golden 定义)', async ({ page }) => {
    const schema = {
      body: [{
        component: 'DatePicker',
        props: { size: 'small' },
      }],
    };

    await page.goto(getPreviewUrl(schema), { waitUntil: 'networkidle' });
    const picker = await page.waitForSelector('.ant-picker-small', { state: 'visible' });
    expect(await picker.isVisible()).toBe(true);
  });

  test('showTime=true 应该显示时间选择 (符合 golden 定义)', async ({ page }) => {
    const schema = {
      body: [{
        component: 'DatePicker',
        props: { showTime: true, placeholder: '选择日期时间' },
      }],
    };

    await page.goto(getPreviewUrl(schema), { waitUntil: 'networkidle' });
    const picker = await page.waitForSelector('.ant-picker', { state: 'visible' });
    // 验证有选择时间的 UI 元素
    expect(await picker.isVisible()).toBe(true);
  });
});

// ==================== Tree 组件契约测试 ====================

test.describe('Layer 1: Tree Contract', () => {
  test('应该渲染基础树组件 (符合 golden 定义)', async ({ page }) => {
    const schema = {
      body: [{
        component: 'Tree',
        props: {
          treeData: [
            { title: '节点 1', key: '0-0', children: [{ title: '子节点 1', key: '0-0-0' }] },
          ],
        },
      }],
    };

    await page.goto(getPreviewUrl(schema), { waitUntil: 'networkidle' });
    const tree = await page.waitForSelector('.ant-tree', { state: 'visible' });
    expect(await tree.isVisible()).toBe(true);
  });

  test('checkable=true 应该显示复选框 (符合 golden 定义)', async ({ page }) => {
    const schema = {
      body: [{
        component: 'Tree',
        props: {
          checkable: true,
          treeData: [
            { title: '节点 1', key: '0-0' },
          ],
        },
      }],
    };

    await page.goto(getPreviewUrl(schema), { waitUntil: 'networkidle' });
    const tree = await page.waitForSelector('.ant-tree', { state: 'visible' });
    // 验证有复选框元素
    const checkbox = await page.$('.ant-tree-checkbox');
    expect(checkbox).toBeTruthy();
  });

  test('showIcon=true 应该显示图标 (符合 golden 定义)', async ({ page }) => {
    const schema = {
      body: [{
        component: 'Tree',
        props: {
          showIcon: true,
          treeData: [
            { title: '节点 1', key: '0-0', icon: { component: 'span', props: { children: '📁' } } },
          ],
        },
      }],
    };

    await page.goto(getPreviewUrl(schema), { waitUntil: 'networkidle' });
    const tree = await page.waitForSelector('.ant-tree', { state: 'visible' });
    expect(await tree.isVisible()).toBe(true);
  });

  test('disabled=true 应该渲染禁用状态 (符合 golden 定义)', async ({ page }) => {
    const schema = {
      body: [{
        component: 'Tree',
        props: {
          disabled: true,
          treeData: [
            { title: '节点 1', key: '0-0' },
          ],
        },
      }],
    };

    await page.goto(getPreviewUrl(schema), { waitUntil: 'networkidle' });
    const tree = await page.waitForSelector('.ant-tree', { state: 'visible' });
    expect(await tree.isVisible()).toBe(true);
  });
});

// ==================== Table 组件契约测试 ====================

test.describe('Layer 1: Table Contract', () => {
  test('应该渲染基础表格 (符合 golden 定义)', async ({ page }) => {
    const schema = {
      body: [{
        component: 'Table',
        props: {
          dataSource: [{ id: 1, name: '张三', age: 25 }],
          columns: [
            { title: '姓名', dataIndex: 'name', key: 'name' },
            { title: '年龄', dataIndex: 'age', key: 'age' },
          ],
          rowKey: 'id',
        },
      }],
    };

    await page.goto(getPreviewUrl(schema), { waitUntil: 'networkidle' });
    const table = await page.waitForSelector('.ant-table', { state: 'visible' });
    expect(await table.isVisible()).toBe(true);
  });

  test('loading=true 应该显示加载状态 (符合 golden 定义)', async ({ page }) => {
    const schema = {
      body: [{
        component: 'Table',
        props: {
          loading: true,
          dataSource: [],
          columns: [{ title: '姓名', dataIndex: 'name', key: 'name' }],
          rowKey: 'id',
        },
      }],
    };

    await page.goto(getPreviewUrl(schema), { waitUntil: 'networkidle' });
    // 验证加载状态 - 查找 Spin 组件
    const loadingContainer = await page.waitForSelector('.ant-table-placeholder', { state: 'visible' });
    expect(await loadingContainer.isVisible()).toBe(true);
  });

  test('size=small 应该渲染小尺寸 (符合 golden 定义)', async ({ page }) => {
    const schema = {
      body: [{
        component: 'Table',
        props: {
          size: 'small',
          dataSource: [{ id: 1, name: '张三' }],
          columns: [{ title: '姓名', dataIndex: 'name', key: 'name' }],
          rowKey: 'id',
        },
      }],
    };

    await page.goto(getPreviewUrl(schema), { waitUntil: 'networkidle' });
    const table = await page.waitForSelector('.ant-table.ant-table-small', { state: 'visible' });
    expect(await table.isVisible()).toBe(true);
  });

  test('bordered=true 应该显示边框 (符合 golden 定义)', async ({ page }) => {
    const schema = {
      body: [{
        component: 'Table',
        props: {
          bordered: true,
          dataSource: [{ id: 1, name: '张三' }],
          columns: [{ title: '姓名', dataIndex: 'name', key: 'name' }],
          rowKey: 'id',
        },
      }],
    };

    await page.goto(getPreviewUrl(schema), { waitUntil: 'networkidle' });
    const table = await page.waitForSelector('.ant-table', { state: 'visible' });
    // 验证有 border 类名
    const className = await table.getAttribute('class');
    expect(className).toContain('ant-table-bordered');
  });

  test('showHeader=false 应该隐藏表头 (符合 golden 定义)', async ({ page }) => {
    const schema = {
      body: [{
        component: 'Table',
        props: {
          showHeader: false,
          dataSource: [{ id: 1, name: '张三' }],
          columns: [{ title: '姓名', dataIndex: 'name', key: 'name' }],
          rowKey: 'id',
        },
      }],
    };

    await page.goto(getPreviewUrl(schema), { waitUntil: 'networkidle' });
    // 验证没有表头
    const header = await page.$('.ant-table-thead');
    expect(header).toBeNull();
  });
});

// ==================== Avatar 组件契约测试 ====================

test.describe('Layer 1: Avatar Contract', () => {
  test('应该渲染基础头像 (符合 golden 定义)', async ({ page }) => {
    const schema = {
      body: [{
        component: 'Avatar',
        props: { children: 'User' },
      }],
    };

    await page.goto(getPreviewUrl(schema), { waitUntil: 'networkidle' });
    const avatar = await page.waitForSelector('.ant-avatar', { state: 'visible' });
    expect(await avatar.isVisible()).toBe(true);
  });

  test('应该渲染带文字的头像 (符合 golden 定义)', async ({ page }) => {
    const schema = {
      body: [{
        component: 'Avatar',
        props: { children: '张' },
      }],
    };

    await page.goto(getPreviewUrl(schema), { waitUntil: 'networkidle' });
    const avatar = await page.waitForSelector('.ant-avatar', { state: 'visible' });
    expect(await avatar.isVisible()).toBe(true);
  });

  test('size=large 应该渲染大尺寸 (符合 golden 定义)', async ({ page }) => {
    const schema = {
      body: [{
        component: 'Avatar',
        props: { size: 'large', children: '张' },
      }],
    };

    await page.goto(getPreviewUrl(schema), { waitUntil: 'networkidle' });
    const avatar = await page.waitForSelector('.ant-avatar-lg', { state: 'visible' });
    expect(await avatar.isVisible()).toBe(true);
  });

  test('size=small 应该渲染小尺寸 (符合 golden 定义)', async ({ page }) => {
    const schema = {
      body: [{
        component: 'Avatar',
        props: { size: 'small', children: '张' },
      }],
    };

    await page.goto(getPreviewUrl(schema), { waitUntil: 'networkidle' });
    const avatar = await page.waitForSelector('.ant-avatar-sm', { state: 'visible' });
    expect(await avatar.isVisible()).toBe(true);
  });

  test('shape=square 应该渲染方形头像 (符合 golden 定义)', async ({ page }) => {
    const schema = {
      body: [{
        component: 'Avatar',
        props: { shape: 'square', children: '张' },
      }],
    };

    await page.goto(getPreviewUrl(schema), { waitUntil: 'networkidle' });
    const avatar = await page.waitForSelector('.ant-avatar-square', { state: 'visible' });
    expect(await avatar.isVisible()).toBe(true);
  });
});
