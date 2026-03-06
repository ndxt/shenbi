# 分支A执行指南：Contracts Catalog（官网驱动）

> 分支：`feat/contracts-catalog-phase2`
> 目录：`shenbi-worktrees/contracts-catalog`

## 1. 目标与范围
本分支只负责“组件契约目录（contracts）”建设，不做编辑器交互逻辑。

交付目标：
1. 基于 Ant Design 官网组件总览，逐步补全组件契约。
2. 契约格式严格对齐 `packages/schema/types/contract.ts`（v1）。
3. 输出稳定的 `contracts/index.ts` 聚合与查询能力。

## 2. 两步走策略
### Step 1（先跑通）
先覆盖高频组件，验证“抓取/整理 -> 生成契约 -> 校验 -> 消费”链路：
- `Layout` `Layout.Header` `Layout.Content` `Layout.Footer`
- `Row` `Col` `Space`
- `Button` `Input` `Select` `Form` `Form.Item`
- `Card` `Table` `Modal` `Drawer`
- `Tabs` `Tree` `Descriptions` `Descriptions.Item`

### Step 2（再全量）
在 Step 1 稳定后，按官网总览全量补齐，并维护 skip 清单。

## 3. 官网驱动补全方法（必须）
官网入口：`https://ant.design/components/overview-cn/`

执行流程：
1. 从总览页生成组件 manifest（组件名、分类、文档 URL、状态）。
2. 逐个读取组件页 API（props/events/slots/默认值/废弃字段）。
3. 与本地 antd 类型定义互相校正（避免仅靠文案）。
4. 映射到项目契约格式（`ContractProp/ContractEvent/ContractSlot`）。
5. 对子组件使用手工映射表（如 `Form.Item`、`Layout.Header`）。

## 4. 契约映射规则
1. `onXxx` 函数优先落到 `events`。
2. 字面量联合类型映射为 `enum`。
3. 复杂对象先 `object/any`，保留 `description`。
4. 文案中出现废弃字段，写入 `deprecated/deprecatedMessage`。
5. `version` 统一使用 `COMPONENT_CONTRACT_V1_VERSION`。

## 5. 文件边界清单
允许修改：
- `packages/schema/contracts/*.ts`
- `packages/schema/contracts/index.ts`
- `packages/schema/types/contract.ts`（仅必要兼容性微调）
- `packages/schema/types/index.ts`（导出调整）
- `packages/schema/**/__tests__/*`（若新增测试）
- `docs/active/*contracts*`（本分支文档）

禁止修改：
- `apps/preview/src/ui/**`
- `apps/preview/src/App.tsx`
- `packages/engine/**`
- 与契约无关的业务 schema

## 6. 质量门禁
必须通过：
1. `pnpm --filter @shenbi/schema type-check`
2. `pnpm --filter @shenbi/preview type-check`
3. 契约聚合检查：`builtinContracts` 无重复 `componentType`

建议新增：
- manifest 覆盖率检查（`normal = generated + skipped`）

## 7. 提示词（给大模型）
你正在 `feat/contracts-catalog-phase2` 分支工作，只做组件契约目录建设。
请基于 Ant Design 官网总览页 `https://ant.design/components/overview-cn/`，按“先试点后全量”策略补全契约。
严格遵循项目 `packages/schema/types/contract.ts` 的 v1 格式。
优先完成 Step 1 高频组件，确保 `contracts/index.ts` 可查询、可导出。
不要修改编辑器 UI、运行时引擎和预览业务逻辑。
完成后执行并汇报：
- `pnpm --filter @shenbi/schema type-check`
- `pnpm --filter @shenbi/preview type-check`
并列出新增/更新的契约文件清单与 skip 清单。
