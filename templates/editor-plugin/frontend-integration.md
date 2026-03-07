# 前端集成文档

## 一、目标与边界

这份文档面向当前仓库的真实结构，目标是把 AI 页面生成功能接到现有插件化编辑器里，而不是单独再造一套前端状态。

首版边界：

- AI 主实现放在 `packages/editor-plugins/ai-chat`
- 结构性 schema 变更走 `packages/editor-core`
- 宿主继续是 `packages/editor-ui` + `apps/preview`
- 首版验收目标为 `shell` 模式
- `scenarios` 模式只作为测试/演示模式，可禁用或降级 AI 生成功能

明确不做：

- 不新增独立的 `useEditor()` 本地编辑器状态
- 不为 AI 单独扩 `PluginContext`
- 不假设插件能直接往画布层插 overlay

---

## 二、并行开发先冻结的接口契约

前后端要并行开发，先冻结 HTTP/SSE 契约。前端只依赖这些契约，不依赖后端框架。

### 2.1 HTTP API

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

返回 `ComponentContract[]`，首版可支持 `types=Button,Table` 过滤。

#### `POST /api/ai/feedback`

```ts
interface FeedbackRequest {
  sessionId: string;
  rating: 1 | 2 | 3 | 4 | 5;
  feedback?: string;
}
```

### 2.2 SSE API

#### `GET /api/ai/stream`

查询参数：

```ts
interface StreamQuery {
  prompt: string;
  plannerModel?: string;
  blockModel?: string;
}
```

事件流：

```ts
type StreamEvent =
  | { type: 'plan'; data: PagePlan }
  | { type: 'block'; data: { blockId: string; node: SchemaNode } }
  | { type: 'done'; data: { schema: PageSchema; metadata?: GenerateResponse['data']['metadata'] } }
  | { type: 'error'; data: { message: string; code?: string } };
```

只要这个契约不变，前端可以先写 mock，后端可以独立实现真实逻辑。

---

## 三、前端真实落点

### 3.1 需要修改

- `packages/editor-core`
  - 新增 `node.append / node.insertAt / node.remove`
- `packages/editor-plugins/ai-chat`
  - SSE 客户端
  - API 调用封装
  - `EditorAIBridge.appendBlock()` 等增量能力
  - `AIPanel`
  - `useModels`
  - `useAIGeneration`
- `apps/preview`
  - `createAIChatPlugin(...)` 的装配参数
  - `vite.config.ts` 的 dev proxy

### 3.2 原则上不需要修改

- `packages/editor-ui` 的 AI 主业务实现
- `@shenbi/engine`
- 组件库

注意：若未来真的需要插件级 canvas overlay，再单独评审 `editor-plugin-api` / `editor-ui` 扩展点。

---

## 四、前端状态与宿主交互方式

AI 插件必须通过现有宿主协议接入，不维护平行编辑器状态。

### 4.1 唯一允许的编辑器写入口

- `bridge.replaceSchema(schema)`
- `bridge.appendBlock(node, parentTreeId?)`
- `bridge.removeNode(treeId)`
- `bridge.execute(commandId, payload)`

### 4.2 唯一允许的编辑器读入口

- `bridge.getSchema()`
- `bridge.getSelectedNodeId()`
- `bridge.getAvailableComponents()`
- `bridge.subscribe(...)`

### 4.3 不要这样做

- 不要在 AI 插件里自己维护一份 `schema`
- 不要定义类似 `useEditor()` 的局部编辑器状态
- 不要直接在 AI 面板里绕过 bridge 操作宿主数据

---

## 五、推荐目录

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
│   │   └── useAIGeneration.ts
│   ├── ui/
│   │   ├── AIPanel.tsx
│   │   ├── ModelSelector.tsx
│   │   ├── ProgressBar.tsx
│   │   ├── FeedbackModal.tsx
│   │   ├── SkeletonScreen.tsx
│   │   └── BlockFadeIn.tsx
│   └── utils/
│       ├── error-handler.ts
│       ├── retry.ts
│       └── dedupe.ts
```

---

## 六、API 封装

### 6.1 非流式

```ts
// ai/ai-api.ts
export async function generatePage(
  baseUrl: string,
  payload: GenerateRequest,
): Promise<GenerateResponse['data']> {
  const response = await fetch(`${baseUrl}/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw await toAPIError(response);
  }

  const result = await response.json() as GenerateResponse;
  return result.data;
}
```

### 6.2 流式

```ts
// ai/sse-client.ts
export interface StreamCallbacks {
  onPlan?: (plan: PagePlan) => void;
  onBlock?: (blockId: string, node: SchemaNode) => void;
  onDone?: (schema: PageSchema, metadata?: GenerateResponse['data']['metadata']) => void;
  onError?: (message: string) => void;
}

export function createSSEClient(baseUrl: string) {
  return {
    generateStream(payload: GenerateRequest, callbacks: StreamCallbacks) {
      const url = new URL(`${baseUrl}/stream`, window.location.origin);
      url.searchParams.set('prompt', payload.prompt);
      if (payload.plannerModel) url.searchParams.set('plannerModel', payload.plannerModel);
      if (payload.blockModel) url.searchParams.set('blockModel', payload.blockModel);

      const eventSource = new EventSource(url.toString());

      eventSource.onmessage = (event) => {
        const message = JSON.parse(event.data) as StreamEvent;
        switch (message.type) {
          case 'plan':
            callbacks.onPlan?.(message.data);
            break;
          case 'block':
            callbacks.onBlock?.(message.data.blockId, message.data.node);
            break;
          case 'done':
            callbacks.onDone?.(message.data.schema, message.data.metadata);
            eventSource.close();
            break;
          case 'error':
            callbacks.onError?.(message.data.message);
            eventSource.close();
            break;
        }
      };

      eventSource.onerror = () => {
        callbacks.onError?.('Connection lost');
        eventSource.close();
      };

      return {
        cancel() {
          eventSource.close();
        },
      };
    },
  };
}
```

要求：

- `plannerModel` / `blockModel` 必须传给后端
- 组件卸载时必须调用 `cancel()`
- 生成中只能有一个活动连接

---

## 七、模型列表

```ts
// hooks/useModels.ts
const CACHE_KEY = 'shenbi.ai.models';
const CACHE_TTL = 1000 * 60 * 60;

export function useModels(baseUrl: string) {
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let disposed = false;

    const cachedRaw = localStorage.getItem(CACHE_KEY);
    if (cachedRaw) {
      const cached = JSON.parse(cachedRaw) as { data: ModelInfo[]; timestamp: number };
      if (Date.now() - cached.timestamp < CACHE_TTL) {
        setModels(cached.data);
        setLoading(false);
        return () => {
          disposed = true;
        };
      }
    }

    fetch(`${baseUrl}/models`)
      .then((res) => res.json())
      .then((data: { models: ModelInfo[] }) => {
        if (disposed) return;
        setModels(data.models);
        setLoading(false);
        localStorage.setItem(CACHE_KEY, JSON.stringify({
          data: data.models,
          timestamp: Date.now(),
        }));
      })
      .catch(() => {
        if (disposed) return;
        setLoading(false);
      });

    return () => {
      disposed = true;
    };
  }, [baseUrl]);

  return { models, loading };
}
```

---

## 八、AIPanel 接入方式

`AIPanel` 不直接接宿主，而是只依赖 `EditorAIBridge`。

```ts
export interface AIPanelProps {
  bridge?: EditorAIBridge;
  apiBaseUrl?: string;
  defaultPlannerModel?: string;
  defaultBlockModel?: string;
  enableFeedback?: boolean;
  enableModelSelector?: boolean;
}
```

推荐流程：

1. 保存生成前 schema 快照
2. 调用 SSE
3. 收到 `plan` 后更新进度
4. 收到每个 `block` 后调用 `bridge.appendBlock(node)`
5. 收到 `done` 后调用 `bridge.replaceSchema(finalSchema)`
6. 用户取消时调用 `cancel()`，并回滚到生成前 schema

注意：

- 画布占位反馈优先放在 AI 面板内，或用临时 `SchemaNode`
- 不要设计 `bridge.showSkeleton()` 这类新的宿主 API

---

## 九、错误处理

```ts
export async function toAPIError(response: Response): Promise<Error> {
  let message = `Request failed: ${response.status}`;

  try {
    const body = await response.json() as { error?: string };
    if (body.error) {
      message = body.error;
    }
  } catch {
    // ignore
  }

  return Object.assign(new Error(message), { status: response.status });
}

export function presentAPIError(error: unknown, notify: (message: string) => void) {
  const status = typeof error === 'object' && error && 'status' in error
    ? (error as { status?: number }).status
    : undefined;

  if (status === 429) {
    notify('请求过于频繁，请稍后再试');
    return;
  }
  if (status === 503) {
    notify('AI 服务暂时不可用');
    return;
  }
  if (status === 400) {
    notify('请求参数错误');
    return;
  }
  notify(error instanceof Error ? error.message : '生成失败');
}
```

---

## 十、并行开发方式

### 10.1 前端先行

前端可先用 mock 事件流联调：

```ts
const mockEvents: StreamEvent[] = [
  { type: 'plan', data: { pageTitle: 'Demo', blocks: [{ id: 'hero' }] } as PagePlan },
  { type: 'block', data: { blockId: 'hero', node: { component: 'Card' } as SchemaNode } },
  { type: 'done', data: { schema: { id: 'page', body: [] } as PageSchema } },
];
```

只要 mock 的 shape 与正式 API 一致，前端可以先完成：

- `AIPanel`
- `useAIGeneration`
- `EditorAIBridge.appendBlock`
- 错误处理和取消逻辑

### 10.2 后端独立推进

后端只需要按契约返回：

- `GenerateResponse`
- `StreamEvent`
- `ModelInfo[]`

无需等待前端组件完成。

---

## 十一、本地联调

`apps/preview` 使用 Vite proxy 指向 `apps/ai-api`：

```ts
// apps/preview/vite.config.ts
export default defineConfig({
  server: {
    proxy: {
      '/api/ai': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});
```

插件配置：

```ts
createAIChatPlugin({
  apiBaseUrl: '/api/ai',
  getAvailableComponents: () => builtinContracts,
});
```

---

## 十二、不要回退到这些旧思路

- 不要把前端方案写成独立 React demo
- 不要引入 `next/dynamic`
- 不要默认前端运行在 Next.js
- 不要让 AI 面板直接维护自己的 `schema`
- 不要假设后端一定是 Next.js API Routes
