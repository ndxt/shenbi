# AI API 宿主设计文档

## 一、目标

首版目标不是“建设一个 Next.js 全栈系统”，而是为当前仓库提供一个独立、可替换、可并行开发的 AI API 宿主。

分层原则：

- `packages/ai-service`：纯逻辑库，框架无关
- `apps/ai-api`：HTTP/SSE 宿主
- `apps/preview`：前端预览应用，通过 proxy 或环境变量访问 `ai-api`

因此，这份文档默认方案是独立 `apps/ai-api`，而不是强绑定 `Next.js App Router`。

---

## 二、为什么首版不把 Next.js 设为默认前提

可以用 Next.js，但不建议把它写成唯一默认方案。

原因：

- 当前仓库前端应用 `apps/preview` 是 Vite，不是 Next.js
- `ai-service` 已经被定义为可被任意宿主调用的纯服务包
- 首版核心任务是跑通 AI HTTP/SSE 契约，不是同时引入管理后台、数据库运营面和全栈应用模型
- 用独立 `apps/ai-api` 更利于前后端并行开发

结论：

- 首版默认：`apps/ai-api` + 轻量 HTTP 框架
- 可选实现：Hono / Express / Fastify / Next.js Route Handlers
- 只有在后续确实需要 Prompt 管理后台时，再评估是否引入 Next.js 页面层

---

## 三、并行开发先冻结的服务契约

前后端能否并行，关键不是框架，而是契约。

### 3.1 HTTP API

#### `POST /api/ai/generate`

请求：

```ts
interface GenerateRequest {
  prompt: string;
  plannerModel?: string;
  blockModel?: string;
}
```

响应：

```ts
interface GenerateResponse {
  success: true;
  data: {
    schema: PageSchema;
    metadata: {
      sessionId: string;
      plannerModel: string;
      blockModel: string;
      tokensUsed?: number;
      durationMs?: number;
      repairs?: Array<{ message: string; path?: string }>;
    };
  };
}
```

#### `GET /api/ai/models`

```ts
interface ModelInfo {
  id: string;
  name: string;
  provider: string;
  maxTokens?: number;
  features?: string[];
  costPer1kTokens?: { input: number; output: number };
}
```

#### `GET /api/ai/components`

返回：

```ts
interface ComponentsResponse {
  components: ComponentContract[];
}
```

#### `POST /api/ai/feedback`

```ts
interface FeedbackRequest {
  sessionId: string;
  rating: 1 | 2 | 3 | 4 | 5;
  feedback?: string;
}
```

### 3.2 SSE API

#### `GET /api/ai/stream`

查询参数：

```ts
interface StreamQuery {
  prompt: string;
  plannerModel?: string;
  blockModel?: string;
}
```

事件：

```ts
type StreamEvent =
  | { type: 'plan'; data: PagePlan }
  | { type: 'block'; data: { blockId: string; node: SchemaNode } }
  | { type: 'done'; data: { schema: PageSchema; metadata?: GenerateResponse['data']['metadata'] } }
  | { type: 'error'; data: { message: string; code?: string } };
```

这组契约一旦冻结，前后端就可以独立推进。

---

## 四、推荐目录

```text
apps/ai-api/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts
│   ├── server.ts
│   ├── routes/
│   │   ├── generate.ts
│   │   ├── stream.ts
│   │   ├── models.ts
│   │   ├── components.ts
│   │   ├── validate.ts
│   │   └── feedback.ts
│   ├── middleware/
│   │   ├── rate-limit.ts
│   │   ├── request-id.ts
│   │   └── error-handler.ts
│   ├── adapters/
│   │   ├── env.ts
│   │   ├── logger.ts
│   │   └── component-contracts.ts
│   └── types.ts
```

`packages/ai-service/` 继续承载：

```text
packages/ai-service/
├── src/
│   ├── llm/
│   ├── agents/
│   ├── prompt/
│   ├── validator/
│   ├── cache/
│   ├── registry/
│   └── index.ts
```

---

## 五、宿主职责

`apps/ai-api` 只做四类事情：

1. 参数解析与响应序列化
2. 把请求组装为 `ai-service` 调用
3. 限流、日志、错误映射
4. 环境变量和第三方依赖注入

不要把下面这些写死到宿主里：

- Prompt 生成逻辑
- 模型路由策略
- Schema 修复算法
- 组件契约主数据

这些都应该在 `packages/ai-service` 里。

---

## 六、首版 API 设计

### 6.1 `POST /api/ai/generate`

职责：

- 校验请求体
- 组装 `GenerateOptions`
- 调用 `generatePage(...)`
- 返回 `schema + metadata`

示意：

```ts
export async function handleGenerate(request: Request): Promise<Response> {
  const body = await request.json() as GenerateRequest;
  validateGenerateRequest(body);

  const result = await generatePage(body.prompt, {
    plannerModel: body.plannerModel,
    blockModel: body.blockModel,
    contracts: getAvailableContracts(),
  });

  return json({
    success: true,
    data: result,
  });
}
```

### 6.2 `GET /api/ai/stream`

职责：

- 读取 query 参数
- 调用 `generatePageStream(...)`
- 把 `StreamEvent` 序列化为 SSE

示意：

```ts
export async function handleStream(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const prompt = url.searchParams.get('prompt') ?? '';
  const plannerModel = url.searchParams.get('plannerModel') ?? undefined;
  const blockModel = url.searchParams.get('blockModel') ?? undefined;

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of generatePageStream(prompt, {
          plannerModel,
          blockModel,
          contracts: getAvailableContracts(),
        })) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        }
      } catch (error) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
          type: 'error',
          data: { message: toErrorMessage(error) },
        })}\n\n`));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
```

### 6.3 `GET /api/ai/models`

首版可以静态返回支持列表，不要求数据库。

### 6.4 `GET /api/ai/components`

直接基于 `@shenbi/schema` 的 `builtinContracts` 或宿主注入 contracts 返回。

### 6.5 `POST /api/ai/feedback`

首版可写日志或文件；数据库持久化放二期。

### 6.6 `POST /api/ai/validate`

首版可调用 `SchemaRepairer` / schema validator 输出 diagnostics。

---

## 七、`packages/ai-service` 与宿主的边界

### 7.1 `ai-service` 输入

```ts
interface GenerateOptions {
  plannerModel?: string;
  blockModel?: string;
  contracts: ComponentContract[];
}
```

### 7.2 `ai-service` 输出

```ts
interface GenerateResult {
  schema: PageSchema;
  metadata: {
    sessionId: string;
    plannerModel: string;
    blockModel: string;
    tokensUsed?: number;
    durationMs?: number;
    repairs?: Array<{ message: string; path?: string }>;
  };
}
```

### 7.3 不要在宿主里复制这些逻辑

- `LLMClient`
- `PlannerAgent`
- `BlockGeneratorAgent`
- `SchemaRepairer`
- Prompt 渲染

---

## 八、组件契约来源

组件契约以 `@shenbi/schema` 为首选来源。

首版策略：

- 宿主直接复用 `builtinContracts`
- 如果未来有宿主级扩展组件，则通过注入方式拼接

不建议：

- 在 `apps/ai-api` 自己维护一套静态组件白名单
- 在 `packages/ai-service` 里维护一份与前端脱节的平行注册表

---

## 九、Prompt 路线

### 9.1 首版

文件驱动，不引入数据库：

- `packages/ai-service/src/prompt/templates/planner.txt`
- `packages/ai-service/src/prompt/templates/block-generator.txt`

`PromptManager` 负责：

- 读取模板
- 渲染变量
- 可选做内存缓存

### 9.2 二期

如果确实需要运营化 Prompt 管理，再新增：

- PostgreSQL
- `prompts` 表
- `/api/prompts` CRUD
- Prompt 版本与 A/B 测试

这不是首版必需项。

---

## 十、缓存与限流

### 10.1 首版

- L1 内存缓存：Prompt 模板、模型列表、可选生成结果
- 限流：内存 Map 或轻量实现
- 结构化日志：记录 `sessionId / duration / model / success`

### 10.2 二期

- Redis：跨实例缓存与限流
- 数据库：反馈、生成日志、Prompt 版本
- 任务队列：高并发异步化

---

## 十一、错误处理

建议统一成结构化错误映射：

```ts
class ValidationError extends Error {}
class RateLimitError extends Error {}
class LLMError extends Error {}
```

HTTP 映射：

- `ValidationError` -> `400`
- `RateLimitError` -> `429`
- `LLMError` -> `503`
- 其他未知错误 -> `500`

响应结构：

```ts
interface ErrorResponse {
  success: false;
  error: string;
  code?: string;
}
```

---

## 十二、前后端并行开发建议

### 12.1 前端先行

前端只要基于冻结契约 mock：

- `GenerateResponse`
- `StreamEvent`
- `ModelInfo[]`

就能先完成：

- `AIPanel`
- `useModels`
- `useAIGeneration`
- `EditorAIBridge.appendBlock`
- 错误、取消、回滚逻辑

### 12.2 后端独立

后端可不等待前端 UI，直接实现：

- 路由层
- `ai-service` 组装
- 真正的 LLM 调用
- 限流和日志

### 12.3 联调只看契约

联调时只验证：

- 请求字段是否齐全
- SSE 事件 shape 是否一致
- `done` 是否带最终 schema
- 错误码和错误消息是否符合约定

---

## 十三、本地开发

推荐端口：

- `apps/preview`: `5173`
- `apps/ai-api`: `3001`

前端通过 Vite proxy 访问：

```ts
server: {
  proxy: {
    '/api/ai': {
      target: 'http://localhost:3001',
      changeOrigin: true,
    },
  },
}
```

环境变量：

```bash
# apps/ai-api/.env
OPENAI_API_KEY=...
ANTHROPIC_API_KEY=...
GOOGLE_API_KEY=...
DEEPSEEK_API_KEY=...
```

二期才考虑：

- `REDIS_URL`
- `DATABASE_URL`

---

## 十四、如果以后坚持用 Next.js

可以，但应作为一个可选宿主实现，而不是首版默认。

正确姿势是：

- 保持 `packages/ai-service` 不变
- 保持 HTTP/SSE 契约不变
- 仅把 `apps/ai-api` 的宿主实现替换成 Next.js Route Handlers

也就是说，Next.js 应该替换“宿主实现”，不应该反过来定义整套 AI 架构。
