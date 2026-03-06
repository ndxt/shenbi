# `@shenbi/schema`

`@shenbi/schema` 是整个仓库的类型与组件契约源头。后续新增功能时，凡是涉及页面 Schema、动作、组件契约、表达式上下文的类型定义，都应先看这个包。

## 这个包负责什么

- 定义页面 Schema 类型：
  - `PageSchema`
  - `SchemaNode`
  - `ColumnSchema`
  - `LoopDirective`
- 定义动作与表达式类型：
  - `ActionChain`
  - `JSExpression`
  - `JSFunction`
  - `ExpressionContext`
- 定义组件契约：
  - `ComponentContract`
  - `builtinContracts`
  - `getBuiltinContract(...)`

## 对外入口

- 类型入口：`types/index.ts`
- 内置组件契约入口：`contracts/index.ts`
- 包导出：`@shenbi/schema`

## 当前冻结的契约

以下内容视为跨包稳定基线：

- `PageSchema` 及其嵌套结构
- `SchemaNode` / `ColumnSchema` / `LoopDirective`
- `ActionChain`
- `ExpressionContext`
- `ComponentContract`
- `builtinContracts` / `getBuiltinContract(...)`

`engine`、`editor-core`、`editor-ui`、`editor-plugins/*` 都依赖这些类型。这里的破坏性修改会放大到整个仓库。

## 变更规则

1. 优先做增量变更，避免重命名和删除字段。
2. 任何破坏性变更都必须同步检查：
   - `packages/engine/src/types/contracts.ts`
   - `packages/engine/README.md`
   - `docs/README.md`
3. 组件契约新增时，优先新增 contract 文件并补导出，不要直接在消费侧硬编码。

## 不负责什么

- 不负责编译、运行时和渲染逻辑，这些属于 `@shenbi/engine`
- 不负责编辑器状态和命令，这些属于 `@shenbi/editor-core`
- 不负责宿主 UI 和插件接线，这些属于 `@shenbi/editor-ui`

## 参考

- 跨包架构背景：[`docs/active/architecture-overview.md`](../../docs/active/architecture-overview.md)
- 旧的引擎/Schema 冻结说明：[`docs/active/architecture-contract-freeze-v1.md`](../../docs/active/architecture-contract-freeze-v1.md)
