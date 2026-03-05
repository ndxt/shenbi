# Preview 瘦身边界清单（Phase 2）

> 目标：`apps/preview` 只保留“启动壳 + 示例数据 + 最小集成冒烟”，编辑器域逻辑下沉到 `@shenbi/editor-ui` / `@shenbi/editor-core`。

---

## 1. 边界定义

### 必须留在 `apps/preview`

- 示例场景数据与切换：
  - `apps/preview/src/schemas/**`
  - 场景下拉与 Demo 入口（业务演示职责）
- 预览运行时装配（Demo 环境）：
  - `installMockFetch` 注入
  - `antdResolver + ShenbiPage` 的最小装配
- 插件演示占位：
  - `Assets/Rocket/Debug` 等演示性扩展

### 必须下沉出 `apps/preview`

- 文件工作区行为（已完成第一阶段）：
  - 文件列表/打开/保存/另存、快捷键、`beforeunload`
- 编辑器壳层通用编排：
  - 选中节点同步、树与画布联动、节点 patch 分发
- Shell 模式通用能力：
  - URL 模式同步、标题脏标记/撤销重做统一行为
- AI Bridge 状态桥接：
  - `schema + selectedNodeId` 的订阅同步机制

---

## 2. 代码迁移清单（从 `App.tsx` 视角）

| 当前逻辑 | 当前文件 | 目标位置 | 优先级 |
|---|---|---|---|
| 文件工作区（保存/快捷键/离开提示） | `apps/preview/src/App.tsx` | `packages/editor-ui/src/plugins/files/use-file-workspace.ts` | 已完成 |
| 模式 URL 同步（`mode=shell`） | `apps/preview/src/App.tsx` | `packages/editor-ui/src/hooks/useShellModeUrl.ts` | 已完成 |
| 树选中与默认节点兜底 | `apps/preview/src/App.tsx` | `packages/editor-ui/src/hooks/useSelectionSync.ts` | 已完成 |
| 节点 patch 分发（props/style/events/logic/columns） | `apps/preview/src/App.tsx` | `packages/editor-ui/src/hooks/useNodePatchDispatch.ts` | 已完成 |
| AI bridge listeners/snapshot 维护 | `apps/preview/src/App.tsx` | `packages/editor-ui/src/ai/useEditorAIBridge.ts` | 已完成 |
| 编辑器会话编排（editor 初始化/订阅/销毁） | `apps/preview/src/App.tsx` | `packages/editor-ui/src/hooks/useEditorSession.ts` | 已完成 |
| 场景 schema 初始化与切换 | `apps/preview/src/App.tsx` | 保留在 preview（示例职责） | 保留 |

---

## 3. 测试迁移矩阵

## 原则

- `preview`：只保留“用户可见链路”冒烟。
- `editor-ui`：承接交互编排与 hook 级行为测试。
- `editor-core`：承接命令、状态、历史、文件存储一致性测试。

## 已完成

- `apps/preview/src/App.test.tsx` 已删除 5 个重型文件域用例。
- `packages/editor-ui/src/plugins/files/use-file-workspace.test.tsx` 已补文件域与热键覆盖。
- `packages/editor-ui/src/hooks/useSelectionSync.test.tsx` 已承接选中同步逻辑测试。
- `packages/editor-ui/src/hooks/useNodePatchDispatch.test.tsx` 已承接 patch 分发逻辑测试。
- `packages/editor-ui/src/hooks/useShellModeUrl.test.tsx` 已承接模式 URL 同步测试。
- `packages/editor-ui/src/ai/useEditorAIBridge.test.tsx` 已承接 AI bridge 编排测试。
- `packages/editor-ui/src/hooks/useEditorSession.test.tsx` 已承接 editor 会话编排测试。

## 下一步迁移建议

- 从 `apps/preview/src/App.test.tsx` 继续下沉：
  - 保留最小冒烟集合（模式切换/场景切换/AI 生成/基础 setter 回写）
  - 将其余“编排细节断言”持续迁移到 `editor-ui` hook 级测试
- 迁入目标：
  - `packages/editor-ui/src/hooks/*.test.tsx`（编排层）
  - `packages/editor-core/src/*.test.ts`（命令层）

---

## 4. 执行顺序（建议）

1. `P1`：拆 `use-selection-sync`，先迁移对应测试再改 `App.tsx` 接线。
2. `P1`：拆 `use-node-patch-dispatch`，收敛 5 个 patch handler 的重复分支。
3. `P1`：拆 `use-shell-mode-url`，统一 URL 同步逻辑。
4. `P2`：拆 AI bridge hook，`App.tsx` 只负责注入依赖与组装 props。
5. `P2`：拆 `useEditorSession`，收敛 editor 生命周期与 schema 更新入口。
6. `P2`：精简 `App.test.tsx` 为最小冒烟集合。

---

## 5. 完成标准（DoD）

- `apps/preview/src/App.tsx` 不再包含：
  - 文件域细节逻辑
  - 复杂编辑器编排逻辑（超过单纯装配）
- `preview` 侧测试以冒烟为主（集成链路可跑通即可）。
- `editor-ui/editor-core` 对通用行为有稳定单测覆盖。
- 全量通过：
  - `pnpm --filter @shenbi/preview type-check && pnpm --filter @shenbi/preview test`
  - `pnpm --filter @shenbi/editor-ui type-check && pnpm --filter @shenbi/editor-ui test`
  - `pnpm --filter @shenbi/editor-core type-check && pnpm --filter @shenbi/editor-core test`
