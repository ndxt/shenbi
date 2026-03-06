# 分支B执行指南：Editor Setter（UI先行，对接逻辑）

> 分支：`feat/editor-setter-phase2`
> 目录：`shenbi-worktrees/editor-setter`

## 1. 目标与范围
本分支优先完成编辑器 UI 壳与交互骨架，为后续逻辑接入预留稳定接口。

核心目标：
1. 做出“组件栏 + 页面组件树 + Setter 面板 + Action 展示区”的统一 UI。
2. 先用 mock 数据跑通交互路径，不阻塞视觉与布局定稿。
3. 与逻辑层通过明确接口对接，避免 UI 与运行时强耦合。

## 2. UI先行实施原则
1. 先实现静态布局与交互反馈（选中、展开、折叠、切换 tab）。
2. 所有数据通过 adapter 层注入，不在组件内部写业务逻辑。
3. 复杂编辑能力先占位（表达式、代码逃生舱、action 编排详情）。
4. 不改引擎执行逻辑，不改 schema 运行时语义。

## 3. 必做模块（第一阶段）
1. 组件栏：按分类展示组件，支持搜索与点击插入回调。
2. 组件树：展示当前页面节点结构，支持选中状态同步。
3. Setter 面板：
   - 属性（按分组展示）
   - 样式
   - 事件
   - 统一逻辑（if/loop/i18n）
4. 页面级面板：参数、state/computed、方法、context 数据入口。
5. Action 区：先做结构化展示（可先不做拖拽编排）。

## 4. 与逻辑分支的接口约定（必须遵守）
建议固定以下 props 接口：
1. `ComponentPanel`
   - `contracts`
   - `onInsert(componentType)`
2. `SchemaTree`
   - `nodes`
   - `selectedNodeId`
   - `onSelect(nodeId)`
3. `SetterPanel`
   - `selectedNode`
   - `contract`
   - `onPatchProps(patch)`
   - `onPatchStyle(patch)`
   - `onPatchEvents(patch)`
4. `ActionPanel`
   - `actions`
   - `onChange(actions)`

## 5. 文件边界清单
允许修改：
- `apps/preview/src/ui/**`
- `apps/preview/src/panels/**`
- `apps/preview/src/styles/**`
- `apps/preview/src/layout/**`
- `apps/preview/src/features/**`（仅 UI adapter）
- `docs/active/*editor*`（本分支文档）

谨慎修改（需先对齐）：
- `apps/preview/src/App.tsx`（仅注入 UI 容器或 adapter）

禁止修改：
- `packages/engine/**`
- `packages/schema/contracts/**`
- `packages/schema/types/contract.ts`
- 数据源与运行时执行器核心逻辑

## 6. 提示词（给大模型）
你正在 `feat/editor-setter-phase2` 分支工作，任务是先完成编辑器 UI 外壳与交互结构，不修改引擎逻辑。
请围绕以下模块产出：组件栏、页面组件树、Setter 面板（属性/样式/事件/统一逻辑）、Action 展示区。
要求：
1. 视觉风格遵循现有 IDE 主题变量，不新增 AntD 控件作为编辑器壳层核心交互。
2. 数据通过 adapter props 注入，先 mock 后对接。
3. 对复杂能力（表达式、key 绑定、代码逃生舱、action 编排）先做可扩展占位 UI。
4. 不改 `packages/engine/**` 与 `packages/schema/contracts/**`。

完成后输出：
- UI 组件文件清单
- 对接接口定义
- 仍待逻辑接入的占位点

## 7. 验收口径
必须通过：
1. `pnpm --filter @shenbi/preview type-check`
2. `pnpm --filter @shenbi/preview test`

人工验收：
1. 组件栏/组件树/Setter 面板可连贯切换。
2. UI 在深色与浅色主题可用。
3. 不依赖引擎内部实现细节即可渲染。
