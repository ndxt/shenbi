# 神笔阶段2并行交付作战手册（Main统筹）

> 适用分支并行期：`feat/contracts-catalog-phase2` + `feat/editor-setter-phase2`
> 基线提交：`d5904fb`（契约v1 + 多场景切换 + Phase2骨架）

---

## 1. 并行目标

本轮并行不是“做完全部平台能力”，而是先形成可合并闭环：

1. A分支：补齐首批可消费组件契约（官网驱动，先小后大）。
2. B分支：先完成编辑器 UI 壳（组件栏/组件树/Setter/Action区）与对接接口。
3. Main：只做统筹、验收、合并，不引入额外需求。

---

## 2. 分支职责边界

### 2.1 分支A（Contracts Catalog）

允许：
- `packages/schema/contracts/*.ts`
- `packages/schema/contracts/index.ts`
- `packages/schema/types/contract.ts`（仅必要兼容微调）
- `packages/schema/types/index.ts`

禁止：
- `packages/engine/**`
- `apps/preview/src/ui/**`
- `apps/preview/src/App.tsx`（非契约集成需求不改）

参考文档：
- `docs/archive/history-branch-a-contracts-catalog-guide.md`（在A分支）

### 2.2 分支B（Editor Setter）

允许：
- `apps/preview/src/ui/**`
- `apps/preview/src/panels/**`
- `apps/preview/src/styles/**`
- `apps/preview/src/features/**`（UI adapter层）

禁止：
- `packages/engine/**`
- `packages/schema/contracts/**`
- `packages/schema/types/contract.ts`

参考文档：
- `docs/archive/history-branch-b-editor-setter-guide.md`（在B分支）

---

## 3. 固定对接接口（先冻结）

B分支只消费A分支公开接口，不直接耦合具体契约文件路径：

1. `builtinContracts`
2. `builtinContractMap`
3. `getBuiltinContract(componentType)`
4. `ComponentContract`（v1字段）

并行期不允许随意改名以下字段：
- `componentType`
- `category`
- `props.*.type`
- `props.*.enum`
- `events`
- `slots`
- `children`

---

## 4. 合并顺序与门禁

### 4.1 合并顺序（强约束）

1. 先合并 A（契约）
2. 再合并 B（编辑器）
3. 最后 main 做集成修补

### 4.2 每个分支最低门禁

A分支：
1. `pnpm --filter @shenbi/schema type-check`
2. `pnpm --filter @shenbi/preview type-check`
3. 无重复 `componentType`

B分支：
1. `pnpm --filter @shenbi/preview type-check`
2. `pnpm --filter @shenbi/preview test`
3. 不修改 `packages/engine/**` 与 `packages/schema/contracts/**`

Main集成：
1. `pnpm --filter @shenbi/schema type-check`
2. `pnpm --filter @shenbi/preview type-check`
3. `pnpm --filter @shenbi/preview test`

---

## 5. 风险与预案

1. 风险：A契约字段调整击穿B setter渲染。
- 预案：冻结v1字段，仅允许增量字段，不做破坏式重命名。

2. 风险：B直接依赖单个契约文件路径，后续重构即失效。
- 预案：强制只从 `contracts/index.ts` 获取契约。

3. 风险：并行期频繁改Main导致回冲突。
- 预案：Main仅做统筹与验收，不并行加新功能。

---

## 6. 里程碑定义（本轮完成标准）

1. A分支：Step1首批组件契约可查询、可消费。
2. B分支：UI壳与接口打通，复杂逻辑可占位。
3. Main：完成双分支合并并通过统一门禁。

