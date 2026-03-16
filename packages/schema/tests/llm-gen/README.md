# LLM Generation Test Framework

测试框架用于验证 LLM 生成的 PageSchema 的质量和正确性。

## 文件结构

```
packages/schema/
├── contracts/
│   ├── antd-api-golden.json       # Ant Design 6.x API 黄金参考数据
│   └── antd-alignment.test.ts     # Ant Design API 对齐测试
└── tests/
    └── llm-gen/
        ├── types.ts                # 类型定义
        ├── validator.ts            # Schema 校验器
        ├── runner.ts               # 测试运行器
        ├── index.test.ts           # Vitest 入口
        └── cases/
            ├── component-cases.ts  # 组件测试用例 (100+)
            └── action-cases.ts     # Action 测试用例 (19 种)
```

## 使用方式

### 运行契约测试
```bash
cd packages/schema
pnpm test contracts/antd-alignment.test.ts
```

### 运行 LLM 生成测试（Mock 模式）
```bash
cd packages/schema
pnpm test tests/llm-gen/index.test.ts
```

### 运行所有测试
```bash
pnpm test
```

### 使用专用脚本
```bash
pnpm test:llm
```

## 测试用例覆盖

### 组件测试 (100+ cases)

| 类别 | 组件数 | 示例 |
|------|--------|------|
| 基础组件 | 20+ | Button, Input, Select, Radio, Checkbox |
| 表单组件 | 15+ | Form, Form.Item, DatePicker, TimePicker, Upload |
| 数据展示 | 15+ | Table, Card, Avatar, Badge, Tag, Statistic |
| 反馈组件 | 10+ | Modal, Alert, Message, Notification, Result |
| 导航组件 | 10+ | Tabs, Breadcrumb, Steps, Menu, Dropdown |
| 布局组件 | 10+ | Row, Col, Space, Flex, Container, Divider |
| 其他 | 20+ | Tree, TreeSelect, Cascader, Slider, Switch, Rate |

### Action 测试 (19 种)

| Action | 描述 |
|--------|------|
| setState | 设置状态值 |
| callMethod | 调用页面方法 |
| fetch | 发起 HTTP 请求 |
| navigate | 页面路由跳转 |
| message | 显示全局提示 |
| notification | 显示通知提醒 |
| confirm | 显示确认对话框 |
| modal | 打开/关闭弹窗 |
| drawer | 打开/关闭抽屉 |
| validate | 表单验证 |
| resetForm | 重置表单 |
| condition | 条件判断 |
| loop | 循环处理 |
| script | 执行脚本代码 |
| copy | 复制到剪贴板 |
| debounce | 防抖处理 |
| throttle | 节流处理 |
| emit | 触发事件 |
| download | 下载文件 |

## 测试级别

- **L1**: 单属性测试 - 测试组件或 Action 的单个功能点
- **L2**: 多属性组合测试 - 测试多个属性的组合使用
- **L3**: 复杂场景测试 - 测试完整的业务场景（待扩展）

## 通过率阈值

- **L1 测试**: 95%+
- **L2 测试**: 80%+

## 编程方式使用

```typescript
import { runFullTestSuite } from '@shenbi/schema/tests/llm-gen';
import { componentCases, actionCases } from '@shenbi/schema/tests/llm-gen/cases';

const report = await runFullTestSuite([...componentCases, ...actionCases], {
  mode: 'mock',  // 'mock' | 'live' | 'mixed'
  apiEndpoint: 'http://localhost:3001', // Live 模式需要
});

console.log(`Total: ${report.summary.total}`);
console.log(`Pass Rate: ${report.summary.passRate.toFixed(2)}%`);
```

## 配置选项

```typescript
interface TestRunnerConfig {
  mode: 'mock' | 'live' | 'mixed';   // 运行模式
  apiEndpoint?: string;               // LLM API 端点
  apiKey?: string;                    // API 密钥
  model?: string;                     // 模型名称
  concurrency?: number;               // 并发数
  timeout?: number;                   // 超时时间
  mocks?: Record<string, PageSchema>; // Mock 响应映射
}
```

## 校验器功能

`validator.ts` 提供以下校验功能：

1. **结构校验**: PageSchema/SchemaNode 结构合法性
2. **契约校验**: 组件/Props 是否符合契约定义
3. **表达式校验**: `{{ }}` 语法和引用合法性
4. **Action 校验**: 19 种 Action 类型和引用合法性
5. **节点 ID 唯一性**: 检查节点 ID 重复

## 扩展测试用例

### 添加新的组件测试

```typescript
// tests/llm-gen/cases/component-cases.ts
export const componentCasesL1: TestCase[] = [
  {
    id: 'my-component-001',
    name: 'MyComponent - 基础用法',
    category: 'component',
    subCategory: 'MyComponent',
    level: 'L1',
    prompt: '创建一个我的组件',
    expectedComponent: 'MyComponent',
    expectedProps: ['prop1'],
  },
];
```

### 添加新的 Action 测试

```typescript
// tests/llm-gen/cases/action-cases.ts
export const actionCasesL1: TestCase[] = [
  {
    id: 'action-new-001',
    name: 'Action - 新 Action 测试',
    category: 'action',
    subCategory: 'newAction',
    level: 'L1',
    prompt: '创建一个按钮，点击时执行新操作',
    expectedActions: ['newAction'],
  },
];
```

## Live 模式配置

要使用真实 LLM API 进行测试：

```bash
# 设置环境变量（如果需要）
export OPENAI_API_KEY="your-api-key"

# 运行测试
pnpm test tests/llm-gen/index.test.ts -- --env LIVE_MODE=true
```

或在代码中配置：

```typescript
const runner = new TestRunner({
  mode: 'live',
  apiEndpoint: 'https://api.openai.com/v1/chat/completions',
  apiKey: process.env.OPENAI_API_KEY,
  model: 'gpt-4o-mini',
});
```

## 故障排查

### Mock 模式测试失败
- 检查 `generateMockResponse` 函数是否正确生成响应
- 验证 mock 响应的组件名称是否与预期匹配

### Live 模式测试失败
- 检查 API 端点是否正确
- 验证 API 密钥是否有效
- 检查网络连接

### 校验器报错
- 查看具体的 Diagnostic 信息
- 检查 Schema 结构是否符合 PageSchema 类型定义
- 验证组件名称是否在契约中定义

## 下一步工作

### 可选增强
1. **Mock 响应文件** - 为每个测试用例预定义期望的 Schema 输出
2. **HTML 报告** - 集成 vitest HTML reporter
3. **CI 集成** - 在 GitHub Actions 中运行测试
4. **Prompt A/B 测试** - 对比不同 prompt 的生成质量
5. **Golden 扩展** - 将 antd-api-golden.json 扩展至全量组件

### 脚本工具（可选）
- `scripts/fetch-antd-api.ts` - 半自动抓取 Ant Design API
- `scripts/generate-mocks.ts` - 自动生成 Mock 响应
