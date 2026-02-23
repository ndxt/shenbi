# 神笔 阶段 2 剩余工作计划

> 阶段 1 + 1.5 已完成：引擎核心 + CRUD 用户管理页面端到端跑通
> 本文档说明阶段 2 还需要做什么

---

## 已完成 vs 未完成

| 阶段 2 原计划 | 状态 | 说明 |
|--------------|------|------|
| Table 全场景 | ✅ | 1.5 已做：分页/排序/筛选/行选择/可编辑行 |
| Form 校验+联动 | ✅ | 1.5 已做：rules/JSFunction validator/字段联动 |
| Form.List | ⚠️ | 已补动态增删/移动/校验场景；原生 Form.List render-props 语义仍待引擎增强 |
| Modal | ✅ | 1.5 已做：Dialog 渲染系统 |
| Drawer | ✅ | 已补独立验证场景（page.dialogs + Drawer） |
| Tabs | ✅ | 已补可切换场景（activeKey + visited） |
| Tree | ✅ | 已补选中/展开/勾选/loadData 场景 |
| Descriptions | ✅ | 已补详情展示与动态状态场景 |
| CRUD 端到端 | ✅ | 1.5 已做 |
| 组件契约（35+） | ❌ | packages/schema/contracts/ 尚未落地 |
| Playwright 回归 | ❌ | packages/test-suite/ 空 |

---

## 剩余工作（按顺序）

### 1. 补齐组件场景（约 1 周）

用独立的 Demo Schema 验证每个组件，不需要再做完整页面。

> 进度更新（2026-02-23）：Tabs/Tree/Descriptions/Drawer 已完成首版可验证场景；Form.List 已完成动态列表验证版，render-props 原生语义待后续扩展。

**1a. Form.List — 动态增删行**

场景：弹窗中「联系方式」可动态添加多行（姓名+电话），每行有删除按钮，底部有添加按钮。

验证点：
- Form.List add / remove / move 操作
- 每行独立校验
- 通过 `$refs.form.getFieldsValue()` 获取完整数组数据
- 嵌套在 Modal 中使用

引擎可能需要的改动：Form.List 的 children 是 `(fields, { add, remove }) => ReactNode` 渲染函数，需要确认 Schema 如何描述这种模式。如果当前 SchemaRender 不够用，需要扩展。

**1b. Tabs — 多标签页**

场景：详情页顶部 Tabs 切换「基本信息 / 操作日志 / 权限配置」。

验证点：
- Tabs + Tabs.TabPane（或 items 写法）
- activeKey 绑定 state
- onChange 切换
- 懒加载（切换时才渲染内容）

引擎改动：无，纯 props 透传 + 事件绑定，已有能力覆盖。

**1c. Tree — 树形数据**

场景：部门树 / 菜单树，支持展开收起、选中、异步加载子节点。

验证点：
- treeData 表达式绑定
- onSelect / onExpand 事件
- checkable 模式（勾选）
- 异步加载 loadData（JSFunction）

引擎改动：loadData 是 JSFunction 类型 prop，Step 2b 已支持。需确认 async JSFunction 编译正确。

**1d. Descriptions — 描述列表**

场景：用户详情页，展示用户信息的 key-value 布局。

验证点：
- Descriptions + Descriptions.Item
- column / bordered / layout 配置
- Item 中嵌套 Tag / Badge 等组件
- 动态内容表达式

引擎改动：无。

**1e. Drawer — 独立验证**

场景：点击表格行「查看详情」→ 右侧 Drawer 滑出显示详情。

验证点：
- page.dialogs 中 type="drawer" 正确渲染
- width / placement 配置
- 嵌套 Descriptions 展示详情
- 关闭事件

引擎改动：1.5 Dialog 系统已支持，此处只需验证。

---

### 2. 组件契约注册（约 1 周）

**目标**：在 `packages/schema/contracts/` 中为 35+ 常用组件注册 `ComponentContractV1`。

> 契约字段与格式以 `docs/active/component-contract-spec-v1.md` 为准。

ComponentContractV1 的作用（参考 schema 类型定义）：
- 声明每个组件接受哪些 props、类型、默认值
- 声明支持哪些事件、事件参数签名
- 声明支持哪些 slots
- 为编辑器 / LanTu AI 提供组件能力描述

**分批注册**：

| 批次 | 组件 | 数量 |
|------|------|------|
| 第一批 | Button, Input, Select, Form, Form.Item, Table, Modal, Card | 8 |
| 第二批 | Tag, Alert, Space, Divider, Typography, Tabs, Tree, Descriptions | 8 |
| 第三批 | DatePicker, Radio, Checkbox, Switch, InputNumber, Cascader, Upload, Drawer | 8 |
| 第四批 | Popconfirm, Tooltip, Badge, Avatar, Statistic, Progress, Spin, Empty | 8 |
| 第五批 | Menu, Breadcrumb, Pagination, Steps, List, Timeline, Collapse | 7 |

每个契约文件格式：
```typescript
// packages/schema/contracts/button.ts
export const buttonContract: ComponentContractV1 = {
  componentType: 'Button',
  runtimeType: 'antd.Button',
  category: 'general',
  version: '1.0.0',
  props: {
    type: { type: 'enum', enum: ['primary','default','dashed','text','link'], default: 'default', allowExpression: true },
    size: { type: 'enum', enum: ['large','middle','small'], allowExpression: true },
    danger: { type: 'boolean', default: false, allowExpression: true },
    loading: { type: 'boolean', default: false, allowExpression: true },
    disabled: { type: 'boolean', default: false, allowExpression: true },
    icon: { type: 'SchemaNode' },
    // ...
  },
  events: {
    onClick: { params: [{ name: 'event', type: 'MouseEvent' }] },
  },
  slots: {},
  children: { type: 'mixed', description: '按钮文本或子节点' },
};
```

---

### 3. Playwright 截图回归框架（约 1 周）

**目标**：在 `packages/test-suite/` 搭建自动化截图回归，防止后续改动破坏已有页面。

**方案**：
- Playwright 启动 preview 应用
- 加载每个 Demo Schema
- 截图对比（pixelmatch）
- CI 中跑回归

**覆盖场景**：
```
1. demo.json          — 阶段 1 的 6 个基础组件
2. user-management.json — 阶段 1.5 的 CRUD 页面
3. form-list.json      — Form.List 动态增删
4. tabs-detail.json    — Tabs 详情页
5. tree-management.json — Tree 树形管理
6. descriptions.json   — Descriptions 描述列表
```

每个场景截图 2-3 个状态（初始态 / 交互后 / 边界情况），总计约 15-20 张基准截图。

**框架结构**：
```
packages/test-suite/
├── playwright.config.ts
├── screenshots/          # 基准截图（git 提交）
├── tests/
│   ├── demo.spec.ts
│   ├── user-management.spec.ts
│   ├── form-list.spec.ts
│   ├── tabs-detail.spec.ts
│   └── ...
└── utils/
    └── schema-loader.ts  # 加载 Schema + 等待渲染完成
```

---

## 时间线

```
第 1 周：补齐 5 个组件场景（Form.List / Tabs / Tree / Descriptions / Drawer）
第 2 周：组件契约注册（5 批共 39 个组件）
第 3 周：Playwright 回归框架 + 基准截图
```

阶段 2 完成后进入阶段 3（256 场景全覆盖 / 数据流校验 / 性能基准 / 文档）。
