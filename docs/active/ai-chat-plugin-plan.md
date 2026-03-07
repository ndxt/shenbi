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

## AgentEvent 到 UI/Editor 的映射

### UI 映射

- `run:start`
  - 新建本次 run 状态
- `message:start`
  - 新建 assistant 消息
- `message:delta`
  - 追加 assistant 文本
- `tool:start`
  - 展示“正在分析/生成”状态
- `tool:result`
  - 展示工具执行结果摘要
- `error`
  - 显示错误提示
- `done`
  - 收起运行状态

### 编辑器映射

- `plan`
  - 更新进度与占位反馈
- `schema:block`
  - 调用 `bridge.appendBlock(node)`
- `schema:done`
  - 调用 `bridge.replaceSchema(schema)`

## 取消与回滚

首版规则：

1. 开始运行前，保存 `preGenerationSchema = bridge.getSchema()`
2. 流式 block 通过 `appendBlock(...)` 插入
3. 用户点击取消：
   - 关闭 SSE
   - 调用 `bridge.execute('schema.restore', { schema: preGenerationSchema })`
4. 运行成功完成：
   - 调用 `bridge.replaceSchema(finalSchema)`

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
- SSE 连接在卸载时自动关闭

## 并行开发说明

Chat Plugin 可以完全脱离真实后端先开发：

- 用 mock `AgentEvent[]`
- 用 fake SSE client
- 用 stub `EditorAIBridge`

只要 `AgentEvent` 契约稳定，UI 层可以先完成 80% 工作。
