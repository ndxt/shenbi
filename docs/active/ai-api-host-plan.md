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

### 2. `GET /api/ai/run/stream`

职责：

- 读取 query 参数并组装为 `RunRequest`
- 调用 `runAgentStream(...)`
- 把 `AgentEvent` 序列化为 SSE

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
   - 调用 `ai-service` 能力并编排为事件流

## 首版环境变量

```bash
OPENAI_API_KEY=...
ANTHROPIC_API_KEY=...
GOOGLE_API_KEY=...
DEEPSEEK_API_KEY=...
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

## 首版不做的事

- 不默认引入 Next.js
- 不引入 Prompt CRUD 页面
- 不引入 PostgreSQL 作为首版前置
- 不引入 Redis 作为首版前置
- 不引入任务队列作为首版前置

## 测试

首版测试：

- `POST /run` happy path
- `GET /run/stream` SSE 序列化
- 429 限流响应
- Provider 错误映射到 503
- `/models` 与 `/components` 返回结构验证

## 并行开发说明

API Host 可以先不接真实 Chat UI：

- 先接 fake `runAgentStream`
- 先输出 mock `AgentEvent`
- 只要 SSE 契约稳定，Chat Plugin 就能联调
