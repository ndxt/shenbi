---
name: AI Delivery Baseline
overview: 冻结 AI 功能的三层开发边界：Agent Runtime 负责上下文/记忆/工具编排，Chat Plugin 负责对话 UI 与编辑器桥接，API Host 负责 HTTP/SSE、LLM Provider、日志与限流。
todos:
  - id: shared-contracts
    content: 冻结 AgentEvent、RunRequest、FeedbackRequest 等跨层契约
    status: pending
  - id: agent-runtime
    content: 落地 packages/ai-agents 的上下文、记忆、工具编排与事件流
    status: pending
  - id: chat-plugin
    content: 落地 packages/editor-plugins/ai-chat 的聊天 UI、SSE 客户端、EditorAIBridge 接入
    status: pending
  - id: api-host
    content: 落地 apps/ai-api 与 packages/ai-service 的 HTTP/SSE、Provider、日志与限流
    status: pending
  - id: editor-commands
    content: editor-core 新增 node.append / node.insertAt / node.remove / schema.restore
    status: pending
  - id: integration
    content: 三层联调与端到端验证
    status: pending
isProject: false
---

# AI Delivery Baseline

## 冻结结论

从现在开始，AI 相关逻辑按 3 条开发线拆分，不再在一份文档里混合职责：

1. **Agent Runtime**
   - 负责上下文、记忆、工具调用、会话编排、结构化事件输出
   - 推荐包：`packages/ai-agents`
   - 不负责 UI 渲染，不直接耦合具体 Provider SDK

2. **Chat Plugin**
   - 负责聊天界面、消息渲染、输入、取消、错误提示、模型选择、EditorAIBridge
   - 现有包：`packages/editor-plugins/ai-chat`
   - 只消费 AgentEvent，不持有平行编辑器状态

3. **API Host**
   - 负责 HTTP/SSE、LLM Provider、日志、限流、反馈、环境变量与服务装配
   - 推荐宿主：`apps/ai-api`
   - 推荐逻辑层：`packages/ai-service`

## 文档基线

以下 3 份文档是后续实施文档，`ai-plan.md` 只保留冻结边界和共享契约：

- [AI Agent Runtime Plan](docs/active/ai-agent-runtime-plan.md)
- [AI Chat Plugin Plan](docs/active/ai-chat-plugin-plan.md)
- [AI API Host Plan](docs/active/ai-api-host-plan.md)

## 共享边界

### 1. Agent Runtime

职责：

- 构造会话上下文
- 读取/写入记忆
- 编排工具调用
- 决定模型调用顺序
- 输出统一事件流

不负责：

- React 组件渲染
- 插件面板状态
- HTTP 路由和中间件
- Provider SDK 细节

### 2. Chat Plugin

职责：

- 聊天消息 UI
- 输入框、发送、取消、重试
- 消费流式 AgentEvent
- 通过 `EditorAIBridge` 调用 `appendBlock / replaceSchema / execute`
- 在 `shell` 模式下提供 AI 主交互入口

不负责：

- Prompt 管理
- 记忆策略
- Provider 选择细节
- 日志与限流
- 维护独立 editor state

### 3. API Host

职责：

- 请求校验
- SSE 输出
- Provider 装配
- 日志、限流、错误映射
- 反馈接口

不负责：

- 聊天界面
- 编辑器桥接
- 宿主外的前端状态管理

## 冻结契约

以下接口从现在开始作为三层并行开发的基线：

```typescript
interface RunRequest {
  prompt: string;
  plannerModel?: string;
  blockModel?: string;
  conversationId?: string;
  selectedNodeId?: string;
}

interface RunMetadata {
  sessionId: string;
  conversationId?: string;
  plannerModel?: string;
  blockModel?: string;
  tokensUsed?: number;
  durationMs?: number;
  repairs?: Array<{ message: string; path?: string }>;
}

type AgentEvent =
  | { type: 'run:start'; data: { sessionId: string } }
  | { type: 'message:start'; data: { role: 'assistant' } }
  | { type: 'message:delta'; data: { text: string } }
  | { type: 'tool:start'; data: { tool: string; label?: string } }
  | { type: 'tool:result'; data: { tool: string; ok: boolean; summary?: string } }
  | { type: 'plan'; data: PagePlan }
  | { type: 'schema:block'; data: { blockId: string; node: SchemaNode } }
  | { type: 'schema:done'; data: { schema: PageSchema; metadata?: RunMetadata } }
  | { type: 'done'; data: { metadata?: RunMetadata } }
  | { type: 'error'; data: { message: string; code?: string } };

interface RunResponse {
  success: true;
  data: {
    events: AgentEvent[];
    metadata?: RunMetadata;
  };
}

interface ModelInfo {
  id: string;
  name: string;
  provider: string;
  maxTokens?: number;
  features?: string[];
  costPer1kTokens?: {
    input: number;
    output: number;
  };
}

interface FeedbackRequest {
  sessionId: string;
  rating: 1 | 2 | 3 | 4 | 5;
  feedback?: string;
}
```

## 编辑器侧冻结规则

### 1. 结构命令

AI 相关结构写入统一走 `editor-core`：

- `node.append`
- `node.insertAt`
- `node.remove`
- `schema.restore`

### 2. History 规则

- 流式中间态命令：`recordHistory: false`
- 最终完成：`schema.replace(finalSchema)` 形成唯一 undo 记录
- 用户取消：`schema.restore(preGenerationSchema)`，不产生新的 undo 记录

### 3. 选择态

- `editor-core` 只负责 schema 变换
- 选择态修复继续由宿主层 `useSelectionSync` 处理

## 并行开发规则

三条开发线可以并行，但必须遵守下面 3 条：

1. `Agent Runtime -> Chat Plugin` 只通过 `AgentEvent`
2. `Agent Runtime -> API Host` 只通过 `RunRequest / RunMetadata / ModelInfo / FeedbackRequest`
3. `Chat Plugin -> Editor` 只通过 `EditorAIBridge` 与宿主命令

因此可并行方式如下：

- Chat Plugin 先基于 mock `AgentEvent[]` 开发 UI
- Agent Runtime 先基于 fake Provider / fake Tool 开发编排
- API Host 先实现路由、限流、日志和 SSE 序列化

## 首版验收范围

- `shell` 模式支持聊天、页面生成、流式 block 插入、取消、undo/redo
- `scenarios` 模式不作为首版 AI 验收范围，可禁用或降级
- Prompt 管理、数据库、Redis、任务队列都放二期

## 实施顺序

1. 冻结共享契约
2. 先补 `editor-core` 结构命令
3. 并行推进 `ai-agents`、`ai-chat`、`ai-api`
4. 三层联调
5. 补 E2E 与回归测试
