# AI API Host Plan

## 目标

建设独立 `apps/ai-api` 作为 AI 的 HTTP/SSE 宿主，并由 `packages/ai-service` 提供能力层。

职责：

- HTTP/SSE 路由
- Provider 装配
- 错误映射
- 限流与日志
- 模型列表与反馈接口

不负责：

- React UI
- 编辑器桥接
- 聊天消息渲染

## 宿主框架

首版默认：**Node.js + Hono**

原因：

- 轻量
- 天然适合 API / SSE
- 不绑定页面层
- 与 Web `Request / Response / ReadableStream` 模型一致

## 代码组织

```text
apps/ai-api/
├── package.json
├── tsconfig.json
├── .env
└── src/
    ├── server.ts
    ├── app.ts
    ├── routes/
    │   ├── run.ts
    │   ├── run-stream.ts
    │   ├── models.ts
    │   ├── components.ts
    │   ├── feedback.ts
    │   └── validate.ts
    ├── middleware/
    │   ├── rate-limit.ts
    │   ├── request-id.ts
    │   └── error-handler.ts
    └── adapters/
        ├── logger.ts
        ├── env.ts
        ├── providers.ts
        └── contracts.ts
```

`packages/ai-service/` 继续承载：

- `LLMClient`
- Provider adapters
- Planner / Block Generator / Repairer
- PromptManager
- CacheManager

`packages/ai-agents/` 继续承载：

- 上下文
- 记忆
- 工具编排
- `AgentEvent` 输出

## 路由基线

### 1. `POST /api/ai/run`

职责：

- 接收 `RunRequest`
- 调用 `runAgent(...)`
- 返回 `RunResponse`

### 2. `POST /api/ai/run/stream`

职责：

- 接收 JSON `RunRequest`
- 调用 `runAgentStream(...)`
- 把 `AgentEvent` 序列化为 SSE

说明：

- 首版 `RunRequest` 必须携带 `context.schemaSummary` 和 `context.componentSummary`
- 因为流式请求需要传递上下文摘要，首版不使用 `EventSource + GET query`，改用 `fetch` + `text/event-stream`

### 3. `GET /api/ai/models`

- 返回 `ModelInfo[]`

### 4. `GET /api/ai/components`

- 返回可用 `ComponentContract[]`

### 5. `POST /api/ai/feedback`

- 记录用户评分和文本反馈

### 6. `POST /api/ai/validate`

- 校验 schema 合法性

## Provider 与能力装配

推荐分层：

1. `apps/ai-api`
   - 读取环境变量
   - 创建 logger
   - 创建 rate limiter
   - 创建 runtime deps

2. `packages/ai-service`
   - 处理 provider 调用
   - 处理 prompt 模板
   - 处理 schema 生成与修复

3. `packages/ai-agents`
   - 只消费 `AgentRuntimeDeps`
   - 基于注入的 `llm` / `tools` / `memory` 编排为事件流

装配规则：

- `ai-agents` 不直接 import `ai-service`
- API Host 负责把 `ai-service` 的能力函数包装成 `AgentTool` 后注入 `AgentRuntimeDeps.tools`
- 这样 `ai-agents` 可以用 fake deps 独立测试，`ai-service` 也可以独立演进

## Provider 完整列表

首版支持的 LLM Provider：

| Provider | 环境变量 | SDK | 说明 |
|----------|---------|-----|------|
| OpenAI | `OPENAI_API_KEY` | `openai` | GPT-4o / GPT-4o-mini |
| Anthropic | `ANTHROPIC_API_KEY` | `@anthropic-ai/sdk` | Claude 3.5 Sonnet / Claude 3 Haiku |
| Google | `GOOGLE_API_KEY` | `@google/generative-ai` | Gemini 2.0 Flash |
| DeepSeek | `DEEPSEEK_API_KEY` | OpenAI 兼容 | DeepSeek V3 / DeepSeek R1 |
| 阿里云百炼 | `DASHSCOPE_API_KEY` | OpenAI 兼容 | Qwen 系列 |

所有 Provider 统一通过 `LLMProvider` 抽象接口适配：

```typescript
interface LLMProvider {
  id: string;
  chat(request: ChatRequest): Promise<ChatResponse>;
  streamChat(request: ChatRequest): AsyncIterable<ChatChunk>;
}
```

`packages/ai-service/src/llm/providers/` 下每个 Provider 一个文件实现。

## Prompt 路线图

首版 Prompt 管理策略：

- Prompt 模板硬编码在 `packages/ai-service/src/prompts/` 下
- 使用 `{{placeholder}}` 占位符动态注入上下文（如 `{{componentSchemas}}`、`{{currentSchema}}`）
- 不引入数据库存储，不引入版本管理 UI

二期 Prompt 路线图：

- 引入 PostgreSQL 存储 Prompt 版本
- 新增 `POST /api/ai/prompts` / `GET /api/ai/prompts` CRUD 路由
- 支持 A/B 测试（同 Prompt 多版本对比）
- 在生成日志中记录 `promptVersion` 用于回溯

## 首版环境变量

```bash
OPENAI_API_KEY=...
ANTHROPIC_API_KEY=...
GOOGLE_API_KEY=...
DEEPSEEK_API_KEY=...
DASHSCOPE_API_KEY=...
```

二期才引入：

```bash
REDIS_URL=...
DATABASE_URL=...
```

## 首版日志与限流

### 日志

首版至少记录：

- requestId
- sessionId
- model
- durationMs
- success / fail
- error code

### 限流

首版策略：

- 基于 IP 的内存限流
- 10 req/min

二期再切 Redis。

## 错误映射

推荐结构化错误：

```typescript
class ValidationError extends Error {}
class RateLimitError extends Error {}
class LLMError extends Error {}
```

HTTP 映射：

- `ValidationError` -> `400`
- `RateLimitError` -> `429`
- `LLMError` -> `503`
- unknown -> `500`

响应：

```typescript
interface ErrorResponse {
  success: false;
  error: string;
  code?: string;
}
```

## SSE 序列化

`/api/ai/run/stream` 只序列化 `AgentEvent`：

```typescript
for await (const event of runAgentStream(request, deps)) {
  controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
}
```

API Host 不重写事件结构，不生成额外宿主私有字段。

## 监控与可观测

首版至少暴露以下指标（通过日志结构化输出，不强制引入 Prometheus）：

| 指标 | 类型 | 说明 |
|------|------|------|
| `ai.request.count` | counter | 按路由、模型、状态（success/fail）分组 |
| `ai.request.duration_ms` | histogram | 请求耗时 |
| `ai.tokens.used` | counter | 按模型分组的 token 消耗 |
| `ai.rate_limit.rejected` | counter | 被限流拒绝的请求数 |
| `ai.sse.active_connections` | gauge | 当前活跃 SSE 连接数 |
| `ai.provider.error` | counter | 按 provider、error code 分组 |

首版实现方式：在 `middleware/request-id.ts` 和 `error-handler.ts` 中用结构化 JSON 日志输出以上指标。

二期可接入 Prometheus + Grafana。

## SSE 健壮性

- SSE 每 15 秒发送一次 `:heartbeat\n\n`，防止连接被中间代理超时关闭
- 客户端收到 heartbeat 不做特殊处理，仅用于保活
- SSE 连接异常关闭时，服务端只清理连接级资源（如 active connection 计数、日志上下文、stream writer）
- 首版不把异常断开映射为 Agent Runtime cancel；如需真正中断运行，二期再引入明确的 cancellation contract

## 首版不做的事

- 不默认引入 Next.js
- 不引入 Prompt CRUD 页面
- 不引入 PostgreSQL 作为首版前置
- 不引入 Redis 作为首版前置
- 不引入任务队列作为首版前置

## 测试

首版测试：

- `POST /run` happy path
- `POST /run/stream` SSE 序列化
- 429 限流响应
- Provider 错误映射到 503
- `/models` 与 `/components` 返回结构验证

## 二期规划

- **Cancellation contract**：SSE 异常关闭时通知 Agent Runtime 中断运行，减少无效 LLM 调用
- **Plan 确认路由**：新增 `POST /api/ai/run/confirm-plan`，接收用户编辑后的 plan 并恢复暂停的生成流
- **Prompt CRUD**：新增 `GET /api/ai/prompts` / `POST /api/ai/prompts`，支持 Prompt 版本管理
- **Redis 限流**：从内存限流切换到 Redis，支持多实例部署
- **任务队列**：引入 BullMQ，长时间生成异步处理
- **SSE 断点续传**：sessionId + Redis 中间态，客户端重连后从中断点继续推送事件
- **监控接入**：Prometheus exporter + Grafana dashboard

## 并行开发说明

API Host 可以先不接真实 Chat UI：

- 先接 fake `runAgentStream`
- 先输出 mock `AgentEvent`
- 只要 SSE 契约稳定，Chat Plugin 就能联调
