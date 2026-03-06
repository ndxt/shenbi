# 神笔 阶段 2 推进状态与剩余计划

> 阶段 1 + 1.5 已完成：引擎核心 + CRUD 用户管理页面端到端跑通
> 本文档记录阶段 2 当前完成度与下一步重点

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
| 组件契约（35+） | ✅ | `packages/schema/contracts/` 已落地并由 `@shenbi/schema` 运行时导出 |
| Editor Setter（契约驱动） | ✅ | Props/Style/Events/Logic 回写已打通，含 Table/Form.Item 专用入口 |
| Playwright 回归 | ⚠️ | 业务 E2E 已在 `apps/preview/e2e`，截图基线框架未搭建 |

---

## 2026-03-04 已落地增量（主分支）

### 1) 契约与运行时

- `packages/schema/contracts/*.ts` 已形成可用契约集（含 `Button/Input/Select/Form/Form.Item/Table/Modal/Card/...`）。
- `@shenbi/schema` 可直接提供 `builtinContracts / getBuiltinContract` 给编辑器消费。
- `apps/preview/src/test/contracts.test.ts` 覆盖契约运行时一致性与基础结构断言。

### 2) Editor Setter（v1）

- 通用 Props Setter：
  - 按契约类型渲染控件（`enum/select`、`boolean/checkbox`、`number`、`object|array/json`）。
  - 支持表达式保护（`{{...}}` 不被错误强转）。
  - 支持单属性“重置为契约默认值”。
- 高级 Props JSON：
  - 支持批量 patch 回写与错误提示。
- 专用 Setter：
  - `Table.columns`：列增删改（标题/字段/key/宽度/对齐）并回写 schema 顶层 `columns`。
  - `Form.Item`：`label/name/rules.required/rules.required.message` 可视化编辑。

### 3) 质量保障

- `apps/preview` 当前单测通过（含 App 集成 + Setter 面板 + schema-editor）。
- 业务 E2E（CRUD）已可执行，能覆盖主流程增删改查回归。

---

## 剩余工作（按顺序）

### 1. Playwright 截图回归框架（P0）

目标：补齐视觉基线与差异门禁，避免 UI/渲染回退。

- 在 `packages/test-suite/` 搭建截图基线目录与执行脚本。
- 覆盖场景：`user-management`、`form-list`、`tabs-detail`、`tree-management`、`descriptions`、`drawer-detail`、`nine-grid`。
- 在 CI 增加“截图差异阻断”。

### 2. Setter 专用能力扩展（P1）

目标：进一步减少手写 JSON。

- `Form.Item.rules` 常用规则最小可视化：`min/max/pattern`。
- `Table.columns` 增补常用字段：`sorter`、`ellipsis`、`fixed`（最小版）。

### 3. Form.List 原生 render-props 语义（P1）

目标：从“场景可运行”提升到“语义完备”。

- 支持 Schema 层描述 `(fields, { add, remove, move }) => ReactNode`。
- 补齐对应编译与运行时测试。

---

## 时间线

```
第 1 周：Playwright 截图回归框架 + CI 门禁
第 2 周：Setter 专用能力扩展（Form.Item rules / Table.columns）
第 3 周：Form.List render-props 语义补全
```

阶段 2 完成后进入阶段 3（256 场景全覆盖 / 数据流校验 / 性能基准 / 文档）。
