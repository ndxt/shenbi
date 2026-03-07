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

依赖规则：

- `ai-agents` 不直接 import `ai-service` 的具体实现
- 所有能力（LLM 调用、planPage、generateBlock 等）通过 `AgentRuntimeDeps` 注入
- `ai-agents/src/tools/` 只定义工具接口和事件包装逻辑，不包含实际能力实现
- API Host 负责把 `ai-service` 的能力函数包装成 tool 实例注入给 runtime
- 这样 `ai-agents` 可以零依赖 `ai-service` 进行独立开发和测试

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

interface PagePlan {
  pageTitle: string;
  blocks: Array<{
    id: string;
    type: string;
    description: string;
    components: string[];
    priority: number;
    complexity: 'simple' | 'medium' | 'complex';
  }>;
}

type AgentEvent =
  | { type: 'run:start'; data: { sessionId: string; conversationId?: string } }
  | { type: 'message:start'; data: { role: 'assistant' } }
  | { type: 'message:delta'; data: { text: string } }
  | { type: 'tool:start'; data: { tool: string; label?: string } }
  | { type: 'tool:result'; data: { tool: string; ok: boolean; summary?: string } }
  | { type: 'plan'; data: PagePlan }
  | { type: 'schema:block'; data: { blockId: string; node: SchemaNode } }
  | { type: 'schema:done'; data: { schema: PageSchema } }
  | { type: 'done'; data: { metadata: RunMetadata } }
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

### 契约规则

- `AgentEvent` 的所有 `data` 字段必须是 JSON 可序列化的。不允许出现函数、Symbol、循环引用、`undefined` 值。API Host 透传时直接 `JSON.stringify`，Chat Plugin 直接 `JSON.parse`。
- `message:delta.text` 内容为 Markdown 格式。Chat Plugin 负责 Markdown 渲染（首版支持纯文本和基础 Markdown）。
- `schema:done` 只携带最终 schema，不携带 metadata。`done` 是整个运行的总结事件，携带 canonical `RunMetadata`（包含 `tokensUsed`、`durationMs` 等）。
- 取消是纯客户端行为。Agent Runtime 不保证发出终止事件。Chat Plugin 应基于 SSE 连接关闭（而非特定事件）来判断取消状态。
- `PagePlan` 由 Agent Runtime 产出、Chat Plugin 消费、API Host 透传。类型定义放在 `packages/ai-agents/src/types.ts` 并由基线冻结。`SchemaNode` 和 `PageSchema` 继续从 `@shenbi/schema` 导入。

## 编辑器侧冻结规则

### 1. 结构命令

AI 相关结构写入统一走 `editor-core`：

- `node.append`
- `node.insertAt`
- `node.remove`
- `schema.restore`

### 2. History 规则

- 流式中间态命令（`node.append` / `node.insertAt`）：`recordHistory: false`
- 最终完成：`schema.replace(finalSchema)` 形成唯一 undo 记录
- 用户取消：`schema.restore(preGenerationSchema)`，不产生新的 undo 记录
- 生成期间（`isRunning = true`）：Chat Plugin 应屏蔽 undo/redo 触发，避免中间态与 history 栈冲突
- 取消是纯客户端行为：Chat Plugin 关闭 SSE 后主动调用 `schema.restore`，不依赖 Agent Runtime 发出终止事件

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

## 已知风险

| 风险 | 首版策略 | 二期方案 |
|------|---------|---------|
| SSE 连接中断后已生成 block 丢失 | 提示重新生成；已插入画布的 block 保留 | sessionId + Redis 中间态，支持断点续传 |
| 缓存 key 冲突（同 prompt 不同模型/版本） | key = `hash(prompt + models + promptVersion)` | 同 |
| 组件契约更新后 Prompt 未同步 | `{{componentSchemas}}` 占位符动态注入，每次生成实时获取 | 同 |
| LLM 费用暴涨 | 限流 10 req/min + 模型分级 | 缓存 60%+ 命中率 + 成本监控告警 |
| 多 Provider API 格式不统一 | `LLMProvider` 抽象层统一接口 | 同 |
| 生成期间用户编辑画布导致覆盖 | UI 提示"生成中请勿编辑" + 屏蔽 undo/redo | `editor-core` 增加 lock/unlock API |
| 并发请求资源争抢 | 限流控制并发量 | 任务队列（BullMQ）异步处理 |
