# AI Chat Plugin Plan

## 目标

以 `packages/editor-plugins/ai-chat` 为唯一聊天 UI 实现，负责：

- 对话消息列表
- 输入框与发送/取消
- 模型选择
- 错误与反馈
- 消费流式 `AgentEvent`
- 通过 `EditorAIBridge` 与编辑器交互

它不负责：

- Provider 调用
- Prompt 管理
- 记忆策略
- 维护独立 editor state

## 包边界

推荐目录：

```text
packages/editor-plugins/ai-chat/
├── src/
│   ├── index.ts
│   ├── plugin.tsx
│   ├── ai/
│   │   ├── ai-api.ts
│   │   ├── sse-client.ts
│   │   ├── editor-ai-bridge.ts
│   │   └── useEditorAIBridge.ts
│   ├── hooks/
│   │   ├── useModels.ts
│   │   ├── useChatSession.ts
│   │   └── useAgentRun.ts
│   ├── ui/
│   │   ├── AIPanel.tsx
│   │   ├── ChatMessageList.tsx
│   │   ├── ChatInput.tsx
│   │   ├── ModelSelector.tsx
│   │   ├── ProgressBar.tsx
│   │   └── FeedbackModal.tsx
│   └── utils/
│       ├── error-handler.ts
│       ├── retry.ts
│       └── dedupe.ts
```

## 状态模型

推荐在插件内维护 3 组状态：

1. **chat session state**
   - messages
   - active run id
   - current metadata

2. **generation state**
   - isRunning
   - progress
   - preGenerationSchema

3. **ui state**
   - planner model
   - block model
   - feedback modal

## 只允许的编辑器入口

- `bridge.getSchema()`
- `bridge.getSelectedNodeId()`
- `bridge.getAvailableComponents()`
- `bridge.appendBlock(node, parentTreeId?)`
- `bridge.removeNode(treeId)`
- `bridge.replaceSchema(schema)`
- `bridge.execute(commandId, payload)`

不允许：

- 本地 `useEditor()` 平行状态
- 直接操作宿主 React state
- 直接调用 Provider SDK

发起请求前必须先做两步：

- 调用 `bridge.getSchema()`，压缩成 `RunRequest.context.schemaSummary`
- 调用 `bridge.getAvailableComponents()`，压缩成 `RunRequest.context.componentSummary`

## AgentEvent 到 UI/Editor 的映射

### UI 映射

- `run:start`
  - 新建本次 run 状态，屏蔽 undo/redo 操作（避免中间态与 history 栈冲突）
- `message:start`
  - 新建 assistant 消息
- `message:delta`
  - 追加 assistant 文本（Markdown 格式，首版支持纯文本和基础 Markdown 渲染）
- `tool:start`
  - 展示"正在分析/生成"状态
- `tool:result`
  - 展示工具执行结果摘要
- `error`
  - 显示错误提示，恢复 undo/redo
- `done`
  - 收起运行状态，恢复 undo/redo
  - 读取 `done.data.metadata` 存入 session state，用于展示 token 统计、耗时等信息

### 编辑器映射

- `plan`
  - 在面板展示只读 block 列表卡片（pageTitle + 每个 block 的 type、description）
  - 首版不可编辑、不阻塞生成流程，仅作为进度与意图反馈
- `schema:block`
  - 调用 `bridge.appendBlock(node)`
- `schema:done`
  - 调用 `bridge.replaceSchema(schema)`（只携带 schema，不携带 metadata）
- `done`
  - 从 `done.data.metadata` 读取 `RunMetadata`，按需在面板展示

### undo/redo 屏蔽规则

- `run:start` 收到后设 `isRunning = true`，此时拦截编辑器的 undo/redo 快捷键和按钮
- `done` 或 `error` 收到后恢复 `isRunning = false`
- 屏蔽方式推荐：`bridge.execute('history.lock')` / `bridge.execute('history.unlock')`（需 editor-core 配合暴露）
- 如果 editor-core 首版不支持 lock API，Chat Plugin 在 UI 层拦截（禁用 undo/redo 按钮 + 忽略快捷键）

## 取消与回滚

首版规则：

1. 开始运行前，保存 `preGenerationSchema = bridge.getSchema()`
2. 流式 block 通过 `appendBlock(...)` 插入
3. 用户点击取消：
   - 关闭 SSE
   - 调用 `bridge.execute('schema.restore', { schema: preGenerationSchema })`
   - 取消是纯客户端行为，不依赖 Agent Runtime 发出终止事件
4. 运行成功完成：
   - 调用 `bridge.replaceSchema(finalSchema)`
5. SSE 意外断开（网络中断等）：
   - 行为与用户主动取消一致 — 调用 `schema.restore(preGenerationSchema)` 并提示用户重试

## `plugin.tsx` 装配

推荐配置：

```typescript
interface CreateAIChatPluginOptions {
  id?: string;
  name?: string;
  panelId?: string;
  panelLabel?: string;
  order?: number;
  defaultOpen?: boolean;
  defaultWidth?: number;
  apiBaseUrl?: string;
  defaultPlannerModel?: string;
  defaultBlockModel?: string;
  enableFeedback?: boolean;
  enableModelSelector?: boolean;
  getAvailableComponents?: () => ComponentContract[];
}
```

## 首版范围

- 只要求 `shell` 模式完整可用
- `scenarios` 模式可隐藏 AI 插件，或仅展示只读聊天 UI
- 不实现 canvas overlay
- 占位反馈优先通过面板状态或临时 schema node 完成

## 测试

首版测试重点：

- mock `AgentEvent` 渲染消息列表
- `schema:block` -> `bridge.appendBlock`
- `schema:done` -> `bridge.replaceSchema`
- 取消运行回滚到 `preGenerationSchema`
- 一次 undo 回退整次生成
- 生成期间 undo/redo 被屏蔽
- `done` 事件后 metadata 正确存入 session state
- SSE 连接在卸载时自动关闭

## 首版语义澄清

- **整页生成**：首版每次运行都是整页级别 `schema.replace`，不支持局部更新单个 block
- **plan 展示**：`plan` 事件到达后，在面板展示只读 block 列表卡片（pageTitle + 各 block 的 type / description），不阻塞生成流程，不可编辑
- **请求载荷**：每次发送前先把当前 schema 和可用组件压缩成 `RunRequest.context`，再调用 `/run` 或 `/run/stream`
- **重试**：重新发送同一 prompt 时，以当前页面状态重新运行，不自动 undo 上次生成；可保留同一 `conversationId`
- **多轮对话**：`conversationId` 用于 prompt 上下文连续性（agent 记忆前几轮对话），每轮仍然是整页重新生成
- **画布反馈**：生成期间面板展示当前进度（"正在生成第 N 个 block"），画布侧 block 随 `schema:block` 事件逐个出现，首版不做画布自动滚动

## 二期规划

### 局部更新 UI

二期支持"选中 block → 只更新该 block"后，Chat Plugin 需要：

- 输入框展示当前选中节点信息（如"已选中：Hero 区块"）
- 新增 `schema:update` 事件映射 → `bridge.replaceNode(treeId, newNode)`
- 局部更新不需要 `preGenerationSchema` 全量快照，undo 粒度 = 单个 `node.replace`

### Plan 确认

- `plan:confirm-required` 事件到达后暂停生成，展示可编辑的 block 列表
- 用户可删除不想要的 block、调整顺序、修改 description
- 用户点击"确认"后发送编辑后的 plan，继续 block 生成
- 用户点击"取消"后终止生成，不产生任何 schema 变更

### 保留部分结果

- 取消时新增选项："回滚全部"或"保留已生成的 block"
- "保留"时：对已插入的 block 调用 `schema.replace(currentSchema)` 形成 undo 记录，而非 `schema.restore`

### 画布联动

- 生成时画布自动滚动到最新插入的 block
- 面板展示"正在插入第 N/M 个 block"进度条
- block 插入时带入场动画（fade-in / slide-up）

### 上下文提示

- 输入框下方展示常用操作模板（"生成登录页"、"添加表单区块"等）
- 根据当前页面状态（空白 / 已有内容）动态调整模板

## 并行开发说明

Chat Plugin 可以完全脱离真实后端先开发：

- 用 mock `AgentEvent[]`
- 用 fake SSE client
- 用 stub `EditorAIBridge`

只要 `AgentEvent` 契约稳定，UI 层可以先完成 80% 工作。
