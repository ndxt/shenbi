# Mastra AI 引入评估报告

## 一、现有 AI 功能全景

经过对代码库的深入分析，当前 Shenbi 低代码平台涉及 AI 能力的场景归纳如下：

### 1.1 现有功能点清单

| # | 功能场景 | 触发方式 | 核心代码位置 | 技术实现 |
|---|---------|---------|-------------|---------|
| **F1** | **页面生成（schema.create）** | Chat 输入 → 意图分类 → [pageBuilderOrchestrator](file:///d:/Code/lowcode/shenbi-codes/shenbi/packages/ai-agents/src/orchestrators/page-builder-orchestrator.ts#104-216) | [packages/ai-agents/src/orchestrators/page-builder-orchestrator.ts](file:///d:/Code/lowcode/shenbi-codes/shenbi/packages/ai-agents/src/orchestrators/page-builder-orchestrator.ts) | Planner LLM 规划 → 骨架 Schema → 并发 Block 生成 → 装配 → 修复 |
| **F2** | **页面修改（schema.modify）** | Chat 输入 → 意图分类 → [modifyOrchestrator](file:///d:/Code/lowcode/shenbi-codes/shenbi/packages/ai-agents/src/orchestrators/modify-orchestrator.ts#40-169) | [packages/ai-agents/src/orchestrators/modify-orchestrator.ts](file:///d:/Code/lowcode/shenbi-codes/shenbi/packages/ai-agents/src/orchestrators/modify-orchestrator.ts) | 两阶段修改：planModify 提取简单+复杂 op → 并发执行复杂 op → 逐条 emit |
| **F3** | **自由聊天（chat）** | Chat 输入 → 意图分类 → [chatOrchestrator](file:///d:/Code/lowcode/shenbi-codes/shenbi/packages/ai-agents/src/orchestrators/chat-orchestrator.ts#3-30) | [packages/ai-agents/src/orchestrators/chat-orchestrator.ts](file:///d:/Code/lowcode/shenbi-codes/shenbi/packages/ai-agents/src/orchestrators/chat-orchestrator.ts) | 流式 LLM 对话，带上下文历史 |
| **F4** | **多页项目生成（Agent Loop）** | Chat 输入 → classify-route → ReAct 循环 | [packages/editor-plugins/ai-chat/src/hooks/useAgentLoop.ts](file:///d:/Code/lowcode/shenbi-codes/shenbi/packages/editor-plugins/ai-chat/src/hooks/useAgentLoop.ts) | 前端 ReAct 循环：规划 → 用户确认 → 逐页 createPage/modifyPage → Finish |
| **F5** | **意图分类（Intent Classification）** | 每次 Run 前自动执行 | [packages/ai-agents/src/intent/rule-classifier.ts](file:///d:/Code/lowcode/shenbi-codes/shenbi/packages/ai-agents/src/intent/rule-classifier.ts) + [apps/ai-api/src/runtime/classify-intent.ts](file:///d:/Code/lowcode/shenbi-codes/shenbi/apps/ai-api/src/runtime/classify-intent.ts) | 规则优先 → LLM 补充分类（schema.create / schema.modify / chat） |

### 1.2 架构分层

```
┌──────────────────────────────────────────────────────────┐
│  Frontend (editor-plugins/ai-chat)                       │
│  AIPanel → useAgentLoop (ReAct) / useAgentRun (Single)   │
│  SSE Client (FetchAIClient) ──► 后端 SSE Stream          │
├──────────────────────────────────────────────────────────┤
│  Contracts (ai-contracts)                                │
│  AgentEvent, RunRequest, AgentOperation, PagePlan 类型    │
├──────────────────────────────────────────────────────────┤
│  Agent SDK (ai-agents)                                   │
│  Orchestrators / Runtime / Memory / Tools / Intent        │
├──────────────────────────────────────────────────────────┤
│  Backend API (apps/ai-api) — Hono                        │
│  agent-runtime.ts (~2100行): planPage, generateBlock,     │
│  modifySchema, classifyIntent, assembleSchema, JSON修复   │
│  OpenAI-Compatible Client → 多 Provider                  │
└──────────────────────────────────────────────────────────┘
```

---

## 二、Mastra AI 能否覆盖现有场景

### 2.1 覆盖能力对照

| 现有功能 | Mastra 对应能力 | 覆盖度 | 说明 |
|---------|---------------|--------|------|
| **F1 页面生成** | Mastra Workflow `.then()/.parallel()` + Agent + Tools | ✅ 可覆盖 | Planner→Block 生成→装配可建模为 Workflow 的 Step 链，Block 并发用 `.parallel()` |
| **F2 页面修改** | Mastra Workflow + Agent Tools | ✅ 可覆盖 | 两阶段修改可建模为 Workflow：Plan Step → 并发 Execute Steps |
| **F3 自由聊天** | Mastra Agent（内置 LLM 对话） | ✅ 可覆盖 | Agent 原生支持对话+记忆 |
| **F4 多页项目生成** | Mastra Workflow + Human-in-the-loop + Agent | ✅ 可覆盖 | Workflow 支持 human-in-the-loop 暂停/确认，可替代前端 ReAct 循环 |
| **F5 意图分类** | Mastra Agent 路由 / Workflow 条件分支 | ✅ 可覆盖 | 可用 `.branch()` 做条件路由，或用 Agent 的 tool selection |

### 2.2 无法直接覆盖的部分

| 现有功能 | Mastra 缺失点 | 需要保留/适配 |
|---------|-------------|-------------|
| **JSON 修复/Salvage 逻辑** | Mastra 不提供 JSON 结构修复 | 需保留 [agent-runtime.ts](file:///d:/Code/lowcode/shenbi-codes/shenbi/apps/ai-api/src/runtime/agent-runtime.ts) 中 ~300 行的 JSON salvage 逻辑作为 Tool |
| **Block Quality Assessment** | Mastra 无 UI 组件质量诊断 | 需保留 [assessBlockQuality](file:///d:/Code/lowcode/shenbi-codes/shenbi/apps/ai-api/src/runtime/agent-runtime.ts#334-551) 作为 Workflow Step 或 Tool |
| **Schema Normalization** | Mastra 不了解 Shenbi Schema 结构 | 需保留 `normalize-schema.ts` 作为 Tool |
| **Component Catalog** | 领域特定，Mastra 无此概念 | 需保留 [component-catalog.ts](file:///d:/Code/lowcode/shenbi-codes/shenbi/apps/ai-api/src/runtime/component-catalog.ts) 作为 Context Provider |
| **前端 SSE 事件协议** | Mastra 有自己的流式协议 | 需要**适配层**将 Mastra 事件映射为现有 [AgentEvent](file:///d:/Code/lowcode/shenbi-codes/shenbi/packages/ai-contracts/src/index.ts#199-217) 类型 |

> [!IMPORTANT]
> **结论：Mastra 可覆盖全部 5 个核心 AI 场景的编排逻辑**，但领域特定的工具函数（JSON 修复、Schema 规范化、组件目录、质量检测）必须保留并包装为 Mastra Tools。

---

## 三、对现有功能、UI、流程的影响（破坏点分析）

### 3.1 破坏点清单

| # | 影响区域 | 破坏风险 | 详细说明 |
|---|---------|---------|---------|
| **B1** | **Chat UI（AIPanel.tsx）** | 🔴 高 | 当前 UI 深度绑定 [AgentEvent](file:///d:/Code/lowcode/shenbi-codes/shenbi/packages/ai-contracts/src/index.ts#199-217) SSE 协议（`schema:skeleton`, `schema:block`, `modify:op` 等 16 种事件类型）。Mastra 有自己的流式协议，需要事件适配层或修改 UI 消费逻辑 |
| **B2** | **useAgentRun Hook** | 🔴 高 | ~569 行代码直接消费 `runPageExecution` 的 SSE callback 体系，与 Mastra 的 Agent/Workflow 执行模型不兼容 |
| **B3** | **useAgentLoop Hook（ReAct 循环）** | 🔴 高 | ~1466 行前端 ReAct 实现，包括 ReAct 解析、工具执行、状态持久化。若用 Mastra Workflow 替代，此 Hook 需大幅重写或废弃 |
| **B4** | **SSE Client（FetchAIClient）** | 🟡 中 | 当前直接 POST 到 `/api/ai/run/stream`，Mastra 可能使用不同的端点和协议 |
| **B5** | **Agent Runtime（2100 行）** | 🟡 中 | 核心编排逻辑（planPage → generateBlock → assemble）会被 Mastra Workflow 替代，但工具函数需保留 |
| **B6** | **API 路由层** | 🟢 低 | Hono 路由层本身解耦，添加 `/api/ai/mastra/*` 路由即可共存 |
| **B7** | **Contracts（AgentEvent 类型）** | 🟡 中 | 需要定义 Mastra 事件到 AgentEvent 的映射，或引入新的事件类型 |
| **B8** | **Memory Store** | 🟢 低 | Mastra 有自己的 Memory 系统，可并行存在 |
| **B9** | **Model 选择器 UI** | 🟢 低 | Mastra 支持 40+ 模型提供商，可保持现有 UI 不变，后端切换到 Mastra 的模型路由 |
| **B10** | **测试套件** | 🟡 中 | 现有单元测试（sse-client.test, agent-tools.test, operation-executor.test 等）在迁移期间需保持通过 |

### 3.2 Chat UI 具体影响

当前 [AIPanel.tsx](file:///d:/Code/lowcode/shenbi-codes/shenbi/packages/editor-plugins/ai-chat/src/ui/AIPanel.tsx) 消费的事件流和交互流程：

```
用户输入 → handleSend → runAgent() → SSE 流
  ├─ run:start → 记录 sessionId
  ├─ intent → 显示意图
  ├─ message:start/delta → 显示 AI 文本
  ├─ tool:start/result → 显示工具进度
  ├─ plan → 显示页面规划
  ├─ schema:skeleton → 骨架预览
  ├─ schema:block → 实时插入 Block
  ├─ modify:start/op/done → 逐条应用修改
  └─ done → 完成，显示统计
```

> [!WARNING]
> **如果引入 Mastra 且希望复用现有 Chat UI，必须实现事件适配层**（Mastra Event → AgentEvent），否则 UI 将无法正确渲染进度。这是工作量最大的适配点。

---

## 四、未来扩展性对比

### 4.1 新增 Gateway 生成/编辑

| 维度 | 当前方案 | Mastra 方案 |
|------|---------|-----------|
| 新增 Orchestrator | 需手写 `gatewayBuilderOrchestrator`，注册到 Registry | 定义新 Workflow，声明 Step/Tool 即可 |
| Gateway + 页面联合生成 | 需在 Agent Loop 的 ReAct 里增加 `createGateway` action，手写解析逻辑 | Workflow 天然支持多步骤编排：`generateGateway.then(generatePage).then(bindAPI)` |
| 错误重试 | 需手写 retry 逻辑 | Mastra Workflow 内置 retry、error handling |
| 可视化调试 | 无（仅写 trace dump 文件） | Mastra Playground 提供可视化调试界面 |

### 4.2 页面+接口整合

| 维度 | 当前方案 | Mastra 方案 |
|------|---------|-----------|
| 联合编排 | 需将 pageBuilder + modifyOrchestrator + 新 gateway logic 手动串联 | Workflow 天然支持 `.then()` 串行、`.parallel()` 并行、`.branch()` 条件 |
| 上下文传递 | 手动在 context/memory 中维护 | Workflow Step 之间自动传递类型化的输入输出 |
| Human-in-the-loop | 前端 ReAct 自行实现 confirm 机制 | Mastra Workflow 内置 human-in-the-loop 暂停点 |

### 4.3 扩展性总结

| 评估维度 | 当前方案 | Mastra 方案 | 优势方 |
|---------|---------|-----------|-------|
| 新增场景的开发成本 | 高（需手写 Orchestrator + 前端 ReAct 逻辑） | 低（定义 Workflow + Tool） | ✅ Mastra |
| 流程编排灵活性 | 有限（硬编码 Orchestrator 模式） | 高（声明式 Workflow DSL） | ✅ Mastra |
| 多 Agent 协作 | 不支持 | 内置多 Agent 编排 | ✅ Mastra |
| 可观测性 | 手写 trace dump | 内置 tracing + Playground | ✅ Mastra |
| 类型安全 | 手写类型 | Zod schema 强验证 | ✅ Mastra |
| 社区生态 | 自研 | 开源社区 + 50+ 集成 | ✅ Mastra |
| 领域定制深度 | 极深（完全定制） | 需通过 Tool 封装 | ✅ 当前方案 |
| 运行时可控性 | 完全可控 | 依赖框架黑盒 | ✅ 当前方案 |

---

## 五、与现有方案的对比

### 5.1 代码量对比

| 模块 | 当前方案 | 引入 Mastra 后 |
|------|---------|--------------|
| agent-runtime.ts | ~2100 行（巨型文件） | 拆解为多个 Mastra Tools + Workflow Steps，单文件 < 200 行 |
| orchestrators/ | 3 个文件，~415 行 | 替换为 3 个 Mastra Workflow 定义，~300 行 |
| useAgentLoop.ts | ~1466 行（前端 ReAct） | 大幅精简，Workflow 编排移到后端，前端只消费事件 |
| stream-agent.ts | ~260 行 | 由 Mastra runtime 替代 |
| 总增量 | — | 新增 ~500 行 Mastra 适配代码，减少 ~2000 行自研编排代码 |

### 5.2 维护成本对比

| 维度 | 当前方案 | Mastra 方案 |
|------|---------|-----------|
| LLM 提供商切换 | 手写 OpenAI-compatible 适配器 | Mastra 原生支持 40+ 提供商 |
| 新增 AI 功能 | 修改多个文件（orchestrator + runtime + UI hook） | 新增 Workflow + Tool，UI 仅消费新事件 |
| 调试 AI 行为 | 读 trace dump JSON 文件 | Mastra Playground 可视化 |
| 单元测试 | 手写 mock（MockAIClient 等） | Mastra 内置评估框架 |

---

## 六、风险点与注意事项

### 6.1 风险矩阵

| # | 风险 | 等级 | 影响 | 缓解措施 |
|---|------|------|------|---------|
| **R1** | Mastra 版本不稳定 | 🔴 高 | 1.0 于 2026-01-20 发布，API 可能变动 | 锁定版本，封装适配层隔离框架 API |
| **R2** | 事件协议不兼容 | 🔴 高 | Chat UI 无法渲染进度 | 实现 MastraEvent → AgentEvent 适配层 |
| **R3** | Server Adapter 适配 | 🟡 中 | 当前用 Hono，需确认 Mastra 的 Hono adapter 成熟度 | Mastra 2025-12 已发布 Server Adapters，支持 Hono |
| **R4** | 包体积增大 | 🟡 中 | Mastra 依赖较多 | monorepo 内独立 package，按需引入 |
| **R5** | 学习成本 | 🟢 低 | TypeScript 原生，团队易上手 | Mastra 文档 + Playground 辅助学习 |
| **R6** | 断点调试困难 | 🟡 中 | Workflow 内部执行被框架托管 | 利用 Mastra 内置 tracing 和 Playground |
| **R7** | 双运行时并存时间过长 | 🟡 中 | 维护负担增加 | 制定明确的迁移节奏和验收标准 |

### 6.2 关键注意事项

> [!CAUTION]
> 1. **不要一次性替换**：当前系统已在运行，必须使用环境变量开关（如 `AI_RUNTIME=legacy|mastra`）控制运行时选择
> 2. **保留现有 AgentEvent 协议**：前端 UI 不改动，Mastra 端输出必须适配为 AgentEvent
> 3. **先做单页生成，再做多页**：Agent Loop 的 ReAct 逻辑最复杂，应最后迁移
> 4. **JSON Salvage 等领域工具是核心竞争力**：不能丢弃，必须包装为 Mastra Tool

---

## 七、推荐整合方案

### 7.1 总体策略：并行运行时 + 渐进式迁移

```
Phase 0: 基础设施            Phase 1: 单页生成         Phase 2: 修改          Phase 3: Agent Loop
───────────────────────  ──────────────────────  ────────────────────  ───────────────────
• 安装 Mastra              • page-create-workflow  • modify-workflow     • project-workflow
• 封装现有工具为 Tool        • 事件适配层             • 复用 Tools          • 替代前端 ReAct
• 环境变量开关              • A/B 对比测试           • A/B 对比测试        • 最终清理 legacy
• Hono adapter 集成                                                     
```

### 7.2 Phase 0: 基础设施搭建

#### 新增/修改文件

| 文件 | 说明 |
|------|------|
| `packages/mastra-runtime/src/mastra-instance.ts` [NEW] | 创建 Mastra 实例，配置模型提供商 |
| `packages/mastra-runtime/src/tools/` [NEW] | 将 `planPage`, [generateBlock](file:///d:/Code/lowcode/shenbi-codes/shenbi/apps/ai-api/src/runtime/agent-runtime.ts#1522-1601), [assembleSchema](file:///d:/Code/lowcode/shenbi-codes/shenbi/apps/ai-api/src/runtime/agent-runtime.ts#1661-1721), `modifySchema`, [classifyIntent](file:///d:/Code/lowcode/shenbi-codes/shenbi/packages/ai-agents/src/runtime/stream-agent.ts#55-98), [assessBlockQuality](file:///d:/Code/lowcode/shenbi-codes/shenbi/apps/ai-api/src/runtime/agent-runtime.ts#334-551), `repairSchema`, `normalizeSchema` 包装为 Mastra Tools |
| `packages/mastra-runtime/src/adapters/event-adapter.ts` [NEW] | Mastra 内部事件 → [AgentEvent](file:///d:/Code/lowcode/shenbi-codes/shenbi/packages/ai-contracts/src/index.ts#199-217) 适配器 |
| `apps/ai-api/src/runtime/runtime-switch.ts` [NEW] | 环境变量 `AI_RUNTIME` 控制选择 legacy 还是 mastra 运行时 |

#### 环境变量开关

```env
# .env.local
AI_RUNTIME=legacy        # legacy (默认) | mastra
```

### 7.3 Phase 1: 单页生成 Workflow

```typescript
// 概念示意（非最终代码）
const pageCreateWorkflow = new Workflow({ name: 'page-create' })
  .step(classifyIntentStep)
  .then(planPageStep)
  .then(buildSkeletonStep)
  .then(
    generateBlocksStep,   // 内部并发
    { parallel: true }
  )
  .then(assembleSchemaStep)
  .then(repairSchemaStep)
  .commit();
```

### 7.4 Phase 2: 页面修改 Workflow

```typescript
const pageModifyWorkflow = new Workflow({ name: 'page-modify' })
  .step(classifyIntentStep)
  .then(planModifyStep)
  .then(executeSimpleOpsStep)
  .then(
    executeComplexOpsStep,  // 内部并发
    { parallel: true }
  )
  .commit();
```

### 7.5 Phase 3: 多页项目生成

```typescript
const projectWorkflow = new Workflow({ name: 'project-build' })
  .step(planProjectStep)
  .then(humanConfirmStep)       // human-in-the-loop
  .then(executeProjectStep)     // 循环调用 page-create / page-modify workflow
  .commit();
```

### 7.6 Gateway 扩展预览

一旦 Phase 1-3 完成，新增 Gateway 变成声明式：

```typescript
const gatewayCreateWorkflow = new Workflow({ name: 'gateway-create' })
  .step(planGatewayStep)
  .then(generateNodesStep)
  .then(assembleGatewayStep)
  .commit();

// 联合编排
const fullProjectWorkflow = new Workflow({ name: 'full-project' })
  .step(planProjectStep)
  .then(humanConfirmStep)
  .then(
    pageCreateWorkflow,
    gatewayCreateWorkflow,
    { parallel: true }
  )
  .then(bindPageToGatewayStep)
  .commit();
```

---

## 八、总结

| 维度 | 评分 | 结论 |
|------|------|------|
| 功能覆盖 | ⭐⭐⭐⭐⭐ | 可覆盖全部 5 个现有 AI 场景 |
| UI 影响 | ⭐⭐ | Chat UI 需事件适配层，工作量较大 |
| 未来扩展性 | ⭐⭐⭐⭐⭐ | Gateway、接口整合等新场景的开发成本大幅降低 |
| 风险可控性 | ⭐⭐⭐⭐ | 环境变量开关 + 渐进式迁移方案可控 |
| 总体建议 | **推荐引入** | 通过并行运行时方式引入，零风险试验，长期收益明显 |

> [!TIP]
> **推荐立即执行 Phase 0**（~2天工作量），快速验证 Mastra 在 Shenbi 场景下的实际效果，再决定是否推进 Phase 1-3。

---

## 九、成本分析

| 项目 | 费用 | 说明 |
|------|------|------|
| **Mastra 框架** | ✅ 免费 | MIT 开源协议，可商用、可修改、无限制 |
| **Mastra Playground** | ✅ 免费 | 本地调试工具 |
| **Mastra Cloud** | 💰 可能收费 | 托管服务，**我们不使用**，直接本地集成到 Hono |
| **LLM 模型调用** | 💰 与现有相同 | 无论是否用 Mastra，LLM API 费用不变 |
| **向量数据库（RAG）** | ✅ 免费 | 推荐 LanceDB，零成本本地嵌入式数据库 |
| **Evals 评估** | 混合 | L1/L2 纯规则 ✅ 免费；L3 LLM Judge 💰 需额外一次 LLM 调用 |

> [!NOTE]
> **结论：引入 Mastra 本身零额外费用**，唯一的成本是现有的 LLM API 调用费用（与当前方案完全一致）。

---

## 十、采用决策与理由

### 10.1 最终决策：采用 Mastra AI

经团队讨论，决定**正式采用 Mastra AI** 替代现有自研编排层，理由如下：

| 决策因素 | 分析 |
|---------|------|
| **精力分配** | 当前自研编排代码已达 2100 行（runtime）+ 1466 行（前端 ReAct），维护成本持续增长。应将精力聚焦于**领域知识质量**（组件合约、黄金示例、设计策略）而非编排管道 |
| **核心竞争力** | 组件合约文档、Zone 黄金示例、设计策略、Gateway 节点规格——这些领域知识是决定生成质量的核心，任何框架都替代不了。框架只是编排工具 |
| **扩展需求** | 后续需新增 Gateway 生成、页面+接口联合编排、数据表创建等场景，用 Mastra Workflow DSL 比手写 Orchestrator 高效得多 |
| **评估体系** | `@mastra/evals` 提供现成的评估框架，可快速建立生成质量量化体系 |

### 10.2 聚焦策略

```
编排逻辑 → 交给 Mastra（Workflow + Agent）
领域知识 → 我们持续强化（合约文档、示例、策略）
质量评估 → 用 Mastra Evals + 自定义 Scorer
```

---

## 十一、增量式 Block 生成支持确认

### 11.1 当前流程

```
Plan → 骨架 Schema → 并发生成 Block（每个完成就推到前端渲染） → 组装最终 Schema
```

这种"先出骨架、逐块填充"的 UX 效果是用户体验的关键。

### 11.2 Mastra 实现方案

```typescript
const pageCreateWorkflow = new Workflow({ name: 'page-create' })
  .step(planPageStep)          // 输出 plan + block 列表
  .then(buildSkeletonStep)     // 输出骨架 → emit ArtifactMessage(preview)
  .then(generateBlocksStep)    // 内部并发，每个 block 完成就 emit ArtifactMessage(partial)
  .then(assembleStep)          // 组装 → emit ArtifactMessage(complete)
  .commit();
```

### 11.3 事件映射

| 现有事件 | Mastra 对应 | UMP 消息 |
|---------|------------|---------|
| `schema:skeleton` | `buildSkeletonStep` 输出 | `ArtifactMessage(preview)` |
| `schema:block:start` | 并行 block step 开始 | `ProgressMessage(generating)` |
| `schema:block` | 每个并行 block step 完成 | `ArtifactMessage(partial)` |
| `schema:done` | `assembleStep` 输出 | `ArtifactMessage(complete)` |

> [!NOTE]
> Mastra Workflow 的 `.parallel()` 原生支持并发执行，每个 step 完成时发出事件。需要在 `generateBlocksStep` 内部为每个 block 手动 emit 自定义事件或拆成独立动态 step，两种方式 Mastra 均支持。前端看到的效果完全一致：骨架先出来 → 每个区块逐个填充 → 最终完整页面。

