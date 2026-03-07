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

这些工具本质上调用 `packages/ai-service` 暴露的能力，不在 runtime 内直接写 provider SDK。

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

- `message:delta` 只追加文本，不回撤
- `schema:block` 表示该 block 可增量插入到编辑器
- `schema:done` 表示最终 schema 已收敛，可用于最终替换
- `done` 表示整个运行生命周期结束

## 与 `packages/ai-service` 的关系

`ai-agents` 是编排层，`ai-service` 是能力层。

建议边界：

- `ai-service` 提供：
  - `planPage(...)`
  - `generateBlock(...)`
  - `assembleSchema(...)`
  - `repairSchema(...)`
  - `listModels(...)`
- `ai-agents` 负责：
  - 何时调用这些能力
  - 如何把结果包装成 `AgentEvent`
  - 如何维护运行时记忆

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
