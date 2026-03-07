# AI Agent Runtime Plan

## 目标

新增 `packages/ai-agents`，作为 AI 会话编排层。

它负责：

- 上下文组装
- 记忆读取/写入
- 工具调用编排
- 模型调用顺序
- 统一事件流输出

它不负责：

- React UI 渲染
- HTTP 路由
- Provider SDK 细节

## 包边界

推荐目录：

```text
packages/ai-agents/
├── src/
│   ├── index.ts
│   ├── types.ts
│   ├── runtime/
│   │   ├── run-agent.ts
│   │   ├── stream-agent.ts
│   │   └── event-writer.ts
│   ├── context/
│   │   ├── build-context.ts
│   │   └── selected-node-context.ts
│   ├── memory/
│   │   ├── memory-store.ts
│   │   ├── conversation-memory.ts
│   │   └── page-memory.ts
│   ├── tools/
│   │   ├── registry.ts
│   │   ├── page-plan-tool.ts
│   │   ├── block-generate-tool.ts
│   │   └── schema-assemble-tool.ts
│   └── orchestrators/
│       ├── chat-orchestrator.ts
│       └── page-builder-orchestrator.ts
```

## 输入与输出

输入基线：使用 `RunRequest`。  
输出基线：只输出 `AgentEvent`。

核心接口：

```typescript
interface AgentRuntimeDeps {
  llm: {
    chat(request: unknown): Promise<unknown>;
    streamChat(request: unknown): AsyncIterable<unknown>;
  };
  tools: AgentToolRegistry;
  memory: AgentMemoryStore;
  logger?: {
    info(message: string, payload?: Record<string, unknown>): void;
    error(message: string, payload?: Record<string, unknown>): void;
  };
}

export async function runAgent(
  request: RunRequest,
  deps: AgentRuntimeDeps,
): Promise<AgentEvent[]>;

export async function* runAgentStream(
  request: RunRequest,
  deps: AgentRuntimeDeps,
): AsyncGenerator<AgentEvent>;
```

## 首版能力

### 1. Context

首版上下文来源：

- 当前用户 prompt
- 已选中节点 id
- 当前页面 schema 摘要
- 可用组件摘要

首版只做摘要，不直接把整个 schema 原样塞进 prompt。

### 2. Memory

首版记忆收敛为：

- 最近若干轮对话
- 最近一次生成 metadata
- 最近一次生成的 block id 列表

存储实现：

- 首版：内存 store 即可
- 二期：文件 / Redis / DB

### 3. Tool Orchestration

首版工具列表：

- `planPage`
- `generateBlock`
- `assembleSchema`
- `repairSchema`

**依赖注入规则**：

`ai-agents` 不直接 import `ai-service` 的具体实现。工具通过 `AgentRuntimeDeps.tools` 注入：

- `ai-agents/src/tools/` 只定义工具的**接口**（输入/输出类型）和**事件包装逻辑**（把工具结果转换为 `AgentEvent`）
- 工具的实际能力函数（调用 LLM、生成 schema 等）由 API Host 负责包装并注入
- 这样 `ai-agents` 零依赖 `ai-service`，可以用 fake tools 独立开发和测试

```typescript
// ai-agents/src/tools/registry.ts
interface AgentTool {
  name: string;
  execute(input: unknown): Promise<unknown>;
}

interface AgentToolRegistry {
  get(name: string): AgentTool | undefined;
  list(): AgentTool[];
}
```

API Host 装配示例：

```typescript
// apps/ai-api 中
import { planPage, generateBlock } from '@shenbi/ai-service';

const tools: AgentToolRegistry = createToolRegistry([
  { name: 'planPage', execute: (input) => planPage(input, llmClient) },
  { name: 'generateBlock', execute: (input) => generateBlock(input, llmClient) },
]);

const deps: AgentRuntimeDeps = { llm, tools, memory, logger };
```

## 事件流规则

### 1. 必发事件

一次成功运行的推荐时序：

1. `run:start`
2. `message:start`
3. `message:delta` 若干
4. `plan`
5. `schema:block` 若干
6. `schema:done`
7. `done`

失败时：

1. `run:start`
2. 可选若干中间事件
3. `error`

### 2. Chat/UI 可依赖规则

- `message:delta` 只追加文本，不回撤。内容为 Markdown 格式
- `schema:block` 表示该 block 可增量插入到编辑器
- `schema:done` 表示最终 schema 已收敛，可用于最终替换。只携带 schema，不携带 metadata
- `done` 表示整个运行生命周期结束，携带 canonical `RunMetadata`（tokensUsed、durationMs 等）
- 取消是客户端行为。Agent Runtime 不保证发出终止事件，不需要处理 cancel 信号

## 与 `packages/ai-service` 的关系

`ai-agents` 是编排层，`ai-service` 是能力层。二者之间没有直接 import 依赖，通过 `AgentRuntimeDeps` 解耦。

运行时关系：

- `ai-service` 提供能力函数：`planPage(...)`, `generateBlock(...)`, `assembleSchema(...)`, `repairSchema(...)`, `listModels(...)`
- API Host 把 `ai-service` 的能力函数包装成 `AgentTool`，注入 `AgentRuntimeDeps.tools`
- `ai-agents` 只通过 `deps.tools.get('planPage').execute(...)` 调用，不知道具体实现

编译时关系：

- `ai-agents` 的 `package.json` 不依赖 `@shenbi/ai-service`
- 两者可以完全并行开发
- 共享类型（`PagePlan`、`SchemaNode`、`PageSchema`）通过 `@shenbi/schema` 和基线契约获取

## 不要做的事

- 不要直接 import OpenAI / Anthropic SDK
- 不要 import React / editor bridge
- 不要输出宿主私有结构
- 不要让 memory 设计依赖数据库首版落地

## 测试

首版测试：

- `runAgentStream` 的事件时序测试
- tool 调用失败时的 `error` 事件测试
- memory 注入与回写测试
- page-builder orchestrator 的 happy path 测试

## 并行开发说明

Agent Runtime 可以在没有真实 API Host 的情况下独立开发：

- 用 fake `llm.streamChat`
- 用 fake `tools`
- 只要输出的 `AgentEvent` 契约稳定，Chat Plugin 就能先联调
