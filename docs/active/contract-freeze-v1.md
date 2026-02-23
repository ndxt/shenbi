# Shenbi 接口契约冻结（M0-2）

版本：`v1.0.0`  
冻结日期：`2026-02-20`

本文档对应 `docs/active/architecture-design.md` 第五节，作为并行开发的契约基线。

## Source Of Truth

唯一类型来源文件：

- `packages/engine/src/types/contracts.ts`
- `packages/schema/types/index.ts`

在 MVP-1 并行开发期间，以下接口字段视为冻结，不允许随意增删改名：

- `CompiledExpression`
- `CompiledColumn`
- `CompiledLoop`
- `CompiledNode`
- `StateAction`
- `PageRuntime`
- `ComponentResolver`

## 契约范围

1. 编译层输出 -> 渲染层输入  
`CompiledNode` 及其嵌套结构（`compiledChildren/compiledSlots/compiledColumns/loop`）。

2. 运行时 -> 渲染层  
`PageRuntime`（`state/dispatch/executeActions/getContext/computed/dialogPayloads/registerRef`）。

3. 组件解析  
`ComponentResolver`（`resolve/register/registerAll/has`）。

## 变更规则

1. 任何契约变更必须同时更新：
`docs/active/contract-freeze-v1.md`、`packages/engine/src/types/contracts.ts`、`docs/active/phase-2-plan.md`（若影响任务依赖）。
2. 契约变更必须附带兼容策略（例如新增字段默认值、旧字段废弃期）。
3. 并行阶段内禁止破坏性改动（重命名、删除、语义反转）。

## M0-3 Mock 对齐文件

用于 Worker A/B 独立开发联调的 mock：

- `packages/engine/src/__mocks__/compiled-node.ts`
- `packages/engine/src/__mocks__/runtime.ts`
- `packages/engine/src/__mocks__/resolver.ts`
- `packages/engine/src/__mocks__/page-schema.ts`

这些 mock 的目标是稳定接口，而不是提供最终行为实现。
