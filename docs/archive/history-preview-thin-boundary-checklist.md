# Preview 薄壳化迁移清单

> 目标：`apps/preview` 只保留“示例数据 + mock + demo 配置 + 最小装配入口”，宿主运行时、通用 schema 工具、命令桥接和 `PluginContext` 适配下沉到 `packages`。

---

## 1. 目标边界

### 允许保留在 `apps/preview`

- 示例场景数据：
  - `apps/preview/src/schemas/**`
- Demo mock 与演示仓储：
  - `apps/preview/src/mock/**`
- Demo 插件配置与场景配置：
  - 场景下拉、示例 plugin 列表、演示 icon/label
- Preview 专用 runtime glue：
  - 是否安装 mock fetch
  - `antdResolver + ShenbiPage` 的最小装配

### 必须迁出 `apps/preview`

- 通用 schema tree / path / patch 逻辑
- `scenario` 会话状态、history、文件持久化、命令桥接
- `PluginContext` 宿主适配
- `shell / scenarios` 双模式命令归一
- 非 demo 专属的宿主编排测试

---

## 2. 当前未抽干净的部分

### 2.1 `apps/preview/src/App.tsx`

- 仍包含 `scenario` 会话状态机：
  - `createInitialScenarioSnapshots`
  - `createScenarioHistories`
  - `updateScenarioSnapshot`
  - `updateScenarioSchema`
- 仍包含 `scenario` 命令桥：
  - `executeScenarioCommand`
  - `executeBaseCommand`
  - `executePluginCommand`
- 仍包含宿主适配：
  - `PluginContext` 的 `document / selection / commands / notifications` 组装
- 仍包含 preview runtime 组件：
  - `ScenarioRuntimeView`

### 2.2 `apps/preview/src/editor/schema-editor.ts`

- 这是纯通用工具，不是 preview 数据：
  - `buildEditorTree`
  - `getSchemaNodeByTreeId`
  - `getTreeIdBySchemaNodeId`
  - `patchSchemaNodeProps`
  - `patchSchemaNodeEvents`
  - `patchSchemaNodeStyle`
  - `patchSchemaNodeLogic`
  - `patchSchemaNodeColumns`

### 2.3 `apps/preview/src/App.test.tsx`

- 已经比之前轻，但仍覆盖了一部分宿主编排细节：
  - `Undo`
  - `Save File`
  - mode/scenario bridge
- 这些测试里，用户可见链路应该保留在 preview，桥接细节应继续迁出

---

## 3. 迁移目标映射

| 当前逻辑 | 当前文件 | 目标位置 | 原因 | 优先级 |
|---|---|---|---|---|
| schema tree 构建 | `apps/preview/src/editor/schema-editor.ts` | `packages/editor-core/src/schema-tree.ts` 或同类文件 | 纯 schema 数据层能力 | P1 |
| `treeId <-> schemaNodeId` 映射 | `apps/preview/src/editor/schema-editor.ts` | `packages/editor-core/src/schema-tree.ts` | 纯 schema 数据层能力 | P1 |
| schema patch 纯函数 | `apps/preview/src/editor/schema-editor.ts` | `packages/editor-core/src/schema-editor.ts` 或现有 schema 模块 | 与 UI/preview 无关 | P1 |
| `scenario` snapshot/history/file 状态 | `apps/preview/src/App.tsx` | `packages/editor-ui/src/hooks/useScenarioSession.ts` | React 宿主编排逻辑 | P1 |
| `scenario` 命令执行桥 | `apps/preview/src/App.tsx` | `packages/editor-ui/src/hooks/useScenarioSession.ts` | 宿主运行时能力 | P1 |
| `PluginContext` 组装 | `apps/preview/src/App.tsx` | `packages/editor-ui/src/plugins/create-plugin-context.ts` | 宿主适配器 | P2 |
| `shell/scenarios` 双模式命令归一 | `apps/preview/src/App.tsx` | `packages/editor-ui/src/hooks/useEditorHostBridge.ts` | 宿主桥接逻辑 | P2 |
| `ScenarioRuntimeView` | `apps/preview/src/App.tsx` | `apps/preview/src/runtime/ScenarioRuntimeView.tsx` | 可留 preview，但必须从大壳拆开 | P2 |
| preview 冒烟测试之外的编排测试 | `apps/preview/src/App.test.tsx` | `packages/editor-ui/src/hooks/*.test.tsx` / `packages/editor-core/src/*.test.ts` | 让测试跟着通用能力走 | P3 |

---

## 4. 执行顺序

### P1 先拆纯通用能力

1. 抽 `schema-editor.ts`
2. 在 `editor-core` 补对应单测
3. 把 `preview` 对这些工具的 import 切到 `packages`

### P2 再拆宿主编排

1. 新增 `useScenarioSession`
2. 把 `scenario snapshot/history/open/save/undo/redo` 从 `App.tsx` 挪进去
3. 新增 `createPluginContext` 或同等 host adapter
4. 把 `PluginContext` 装配从 `App.tsx` 移走
5. 拆出 `ScenarioRuntimeView`

### P3 收口测试与入口

1. `App.test.tsx` 只保留用户可见冒烟
2. `editor-ui/editor-core` 补齐迁出的桥接测试
3. `App.tsx` 收口成“配置 + 组合”

---

## 5. `App.tsx` 目标形态

迁移完成后，`apps/preview/src/App.tsx` 应只做这几件事：

- 读取场景配置和 demo schema
- 读取 preview mock/runtime 配置
- 调用 `packages` 提供的宿主 hook
- 生成 demo 插件列表
- 将结果传给 `AppShell`
- 渲染独立的 preview runtime 组件

### 不应再出现的关键词

- `History`
- `LocalFileStorageAdapter`
- `EditorStateSnapshot`
- `executeScenarioCommand`
- `executeBaseCommand`
- `executePluginCommand`
- 大段 `PluginContext` 对象装配
- schema patch/tree 工具实现

---

## 6. 每阶段完成标准

### P1 完成标准

- `apps/preview/src/editor/schema-editor.ts` 已删除或仅保留 preview 专属包装
- `editor-core` 持有 schema tree / patch 主实现
- 相关测试迁入 `packages/editor-core`

当前状态：
- 已完成。`App.tsx` 已切到 `@shenbi/editor-core`，preview 内重复实现和重复测试已删除。

### P2 完成标准

- `App.tsx` 不再直接维护 `scenario` history / save / undo / redo
- `App.tsx` 不再手写 `PluginContext`
- `ScenarioRuntimeView` 已拆出独立文件

当前状态：
- 已基本完成。`scenario` session 已迁入 `packages/editor-ui/src/hooks/useScenarioSession.ts`，`PluginContext` 装配已迁入 `packages/editor-ui/src/plugins/use-plugin-context.ts`，`ScenarioRuntimeView` 已拆到 `apps/preview/src/runtime/ScenarioRuntimeView.tsx`。
- `App.tsx` 仍保留少量 preview-specific 命令包装和 demo 插件配置，这部分属于允许保留的组合逻辑。

### P3 完成标准

- `App.tsx` 主要是 imports + hooks + props 组装
- `App.test.tsx` 只保留最小冒烟集合
- 宿主桥接细节测试迁到 `editor-ui/editor-core`

当前状态：
- 已部分完成。宿主桥接细节已经迁到 `packages/editor-ui/src/hooks/useEditorHostBridge.test.tsx`、`useScenarioSession.test.tsx`、`use-plugin-context.test.tsx`。
- `App.test.tsx` 已从 10 个集成用例收口到 7 个偏用户可见的冒烟用例。
- `App.tsx` 目前已主要由场景配置、hooks 调用、demo plugin 配置和 `AppShell` props 组装构成。

---

## 7. 当前判断

- 结论：`apps/preview` 还没有薄到“只剩数据和配置”
- 当前状态：
  - `packages` 已承接平台主干
  - `preview` 仍然保留较厚的宿主编排
- 下一步最应该先做：
  1. 抽 `apps/preview/src/editor/schema-editor.ts`
  2. 抽 `useScenarioSession`
  3. 抽 `createPluginContext`

---

## 8. 验证门禁

- `pnpm --filter @shenbi/editor-core type-check`
- `pnpm --filter @shenbi/editor-core test`
- `pnpm --filter @shenbi/editor-ui type-check`
- `pnpm --filter @shenbi/editor-ui test`
- `pnpm --filter @shenbi/preview type-check`
- `pnpm --filter @shenbi/preview test`
