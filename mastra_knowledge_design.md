# Mastra AI 知识注入与领域扩展设计方案

## 一、问题概述

Mastra AI 本身不了解 Shenbi 低代码平台的组件体系、Schema 结构、页面布局规范和 Gateway 流程定义。要让 Mastra 生成正确的低代码 JSON，必须系统性地将这些领域知识注入到 Mastra 的 Agent/Workflow 中。

本文档设计三个层面的方案：
1. **页面组件知识** — 让 Mastra 知道如何正确生成页面 Schema JSON
2. **Gateway 组件知识** — 让 Mastra 知道如何生成 Gateway 流程 JSON
3. **全链路知识** — 让 Mastra 知道如何协调创建页面、接口、表的完整业务流程

---

## 二、现有知识体系分析

### 2.1 当前系统已有的知识资产

| 知识资产 | 位置 | 内容 | 规模 |
|---------|------|------|------|
| **组件合约（Contract）** | `packages/schema/contracts/` | 90+ 组件的 props、events、slots、children、usageScenario | ~30 文件 |
| **组件目录（Catalog）** | `apps/ai-api/src/runtime/component-catalog.ts` | 分组、Zone 模板、页面骨架、设计策略、布局模式、黄金示例 JSON | ~1285 行 |
| **设计策略** | `component-catalog.ts` → `designPolicy` | 20 条 B 端页面设计规范 | 嵌入代码 |
| **页面骨架** | `component-catalog.ts` → `pageSkeletons` | 6 种页面类型的标准区域布局 | 嵌入代码 |
| **布局模式** | `component-catalog.ts` → `freeLayoutPatterns` | 4 种自由布局模式 + 组成说明 + 示例 JSON | 嵌入代码 |
| **Zone 黄金示例** | `component-catalog.ts` → `legacyZoneGoldenExamples` | 12 种区域的完整 JSON 范例 | 嵌入代码 |
| **LLM 测试用例** | `packages/schema/tests/llm-gen/cases/` | 1000+ 行组件级 prompt→expected 测试 | 测试文件 |
| **Gateway 节点定义** | `packages/editor-plugins/gateway/src/` | 节点类型、端口、流程文档模型 | ~20 文件 |

### 2.2 当前知识是如何传递给 LLM 的

```
agent-runtime.ts
  ├─ planPage prompt:
  │   ├─ designPolicy (设计策略)
  │   ├─ plannerContractSummary (组件分组摘要)
  │   ├─ pageSkeletonSummary (页面骨架)
  │   └─ freeLayoutPatternSummary (布局模式)
  │
  ├─ generateBlock prompt:
  │   ├─ expandComponents() → 组件详细合约
  │   ├─ zoneGoldenExample → 区域示例 JSON
  │   └─ block description + suggested components
  │
  └─ modifySchema prompt:
      ├─ 当前 schema JSON
      ├─ componentSummary (可用组件列表)
      └─ selectedNode context
```

> [!NOTE]
> 当前方案的核心方法是：**将合约编译为文本摘要，拼接到 System Prompt 中**。这种方式简单有效，但有 Token 效率低、上下文窗口限制等问题。

---

## 三、Mastra 知识注入策略

### 3.1 三种注入方式对比

| 方式 | 适用场景 | 优点 | 缺点 |
|------|---------|------|------|
| **① System Prompt Context** | 核心规范、设计策略 | 每次调用都可见，最高优先级 | Token 占用大，不适合大量数据 |
| **② RAG 向量检索** | 组件合约、示例库、文档 | 按需检索，Token 效率高 | 需要向量数据库，检索准确度依赖 embedding |
| **③ Tool-based Dynamic Retrieval** | 运行时查询组件细节 | 精确、按需、类型安全 | 增加一次 LLM↔Tool 往返 |

### 3.2 推荐的混合策略

```
┌─────────────────────────────────────────────────────────┐
│                  Mastra Agent / Workflow                 │
│                                                         │
│  System Prompt（始终注入）:                               │
│    ├─ Schema 结构规范（SchemaNode 类型定义）               │
│    ├─ 设计策略（20 条规范）                               │
│    └─ 输出格式约束（JSON Schema）                        │
│                                                         │
│  RAG 向量库（按需检索）:                                  │
│    ├─ 组件合约文档（90+ 组件）                            │
│    ├─ 黄金示例 JSON（按区域类型检索）                      │
│    ├─ 页面骨架模板（按页面类型检索）                       │
│    ├─ Gateway 节点文档（按节点类型检索）                   │
│    └─ 布局模式文档（按页面类型检索）                       │
│                                                         │
│  Tools（精确查询）:                                       │
│    ├─ getComponentContract(componentType) → 合约详情     │
│    ├─ listComponentsByGroup(group) → 组件列表            │
│    ├─ getZoneExample(zoneType) → 区域示例 JSON           │
│    ├─ getPageSkeleton(pageType) → 页面骨架               │
│    ├─ getGatewayNodeContract(nodeType) → 节点合约        │
│    └─ validateSchemaNode(node) → 校验结果                │
└─────────────────────────────────────────────────────────┘
```

---

## 四、知识层架构设计

### 4.1 四层知识结构

```
Layer 4: 业务流程知识
  页面+接口+表 联合创建流程、Gateway 流程模式

Layer 3: 页面/Gateway 组合知识
  页面骨架、区域模板、布局模式、Gateway 流程模板

Layer 2: 组件/节点知识
  90+ 页面组件合约、Gateway 节点合约、示例 JSON

Layer 1: 基础规范
  Schema 结构、设计策略、命名约定、输出格式
```

### 4.2 知识文档目录结构

```
packages/mastra-runtime/
  src/
    knowledge/                     # 知识文档根目录
      schemas/                     # Layer 1: 基础规范
        schema-node-spec.md        # SchemaNode 类型说明
        design-policy.md           # 设计策略 20 条
        naming-conventions.md      # ID/命名约定
        output-format.md           # JSON 输出格式约束

      components/                  # Layer 2: 组件知识
        index.md                   # 组件总索引（分组）
        groups/                    # 按分组的摘要文档
          layout-shell.md
          data-display.md
          filters-form.md
          charts.md
          ...
        contracts/                 # 每个组件的合约文档
          Card.md
          Table.md
          Form.md
          ...
        examples/                  # 黄金示例 JSON
          zone-filter.json
          zone-kpi-row.json
          zone-data-table.json
          ...

      gateway/                     # Layer 2: Gateway 知识
        gateway-spec.md            # Gateway Schema 结构
        nodes/                     # 节点合约文档
          start.md
          end.md
          sql-query.md
          condition.md
          loop.md
          ...
        patterns/                  # Gateway 流程模式
          crud-api.json
          approval-flow.json
          batch-process.json

      pages/                       # Layer 3: 页面组合知识
        page-types/                # 页面类型模板
          dashboard.md
          list.md
          form.md
          detail.md
          statistics.md
          custom.md
        layouts/                   # 布局模式
          main-with-side.md
          summary-then-detail.md
          master-detail.md
          split-context-data.md

      workflows/                   # Layer 4: 业务流程知识
        create-page.md             # 创建页面流程
        create-gateway.md          # 创建接口流程
        create-table.md            # 创建数据表流程
        full-project.md            # 完整项目流程
        page-gateway-binding.md    # 页面与接口绑定

    tools/                         # Mastra Tools
      component-knowledge.ts       # 组件知识查询 Tool
      gateway-knowledge.ts         # Gateway 知识查询 Tool
      schema-validator.ts          # Schema 校验 Tool

    rag/                           # RAG 配置
      indexer.ts                   # 知识文档索引器
      retriever.ts                 # 向量检索器
```

---

## 五、具体注入方案

### 5.1 页面组件知识注入

#### 方式 A：编译合约为 Markdown 文档（推荐初期方案）

将现有 `builtinContracts` 编译为结构化 Markdown 文档，供 Mastra Agent 在 System Prompt 或 RAG 中使用：

```typescript
// packages/mastra-runtime/src/knowledge/compile-contracts.ts
import { builtinContracts } from '@shenbi/schema';

export function compileContractToMarkdown(contract: ComponentContract): string {
  return `
## ${contract.componentType}

- **分类**: ${contract.category}
- **用途**: ${contract.usageScenario ?? '通用'}
- **子节点**: ${contract.children?.type ?? 'none'}

### Props
${Object.entries(contract.props ?? {})
  .map(([name, prop]) =>
    `| ${name} | ${prop.type} | ${prop.required ? '✅' : '—'} | ${prop.default ?? '—'} | ${prop.description ?? ''} |`
  ).join('\n')}

### 使用示例
\`\`\`json
${getGoldenExample(contract.componentType)}
\`\`\`
`;
}
```

#### 方式 B：注册为 Mastra Tool（推荐长期方案）

```typescript
// packages/mastra-runtime/src/tools/component-knowledge.ts
import { createTool } from '@mastra/core';
import { z } from 'zod';
import { builtinContractMap } from '@shenbi/schema';

export const getComponentContract = createTool({
  id: 'getComponentContract',
  description: '查询指定组件的完整合约，包括 props、events、slots 和使用示例',
  inputSchema: z.object({
    componentType: z.string().describe('组件类型名，如 Card, Table, Form'),
  }),
  execute: async ({ context }) => {
    const contract = builtinContractMap[context.componentType];
    if (!contract) {
      return { found: false, message: `未找到组件 ${context.componentType}` };
    }
    return {
      found: true,
      componentType: contract.componentType,
      category: contract.category,
      usageScenario: contract.usageScenario,
      props: contract.props,
      events: contract.events,
      slots: contract.slots,
      children: contract.children,
    };
  },
});

export const listComponentsByGroup = createTool({
  id: 'listComponentsByGroup',
  description: '按分组列出可用组件，如 layout-shell, data-display, charts',
  inputSchema: z.object({
    group: z.string().describe('组件分组名'),
  }),
  execute: async ({ context }) => {
    // 从 componentGroups 查询
    return { components: getGroupComponents(context.group) };
  },
});

export const getZoneExample = createTool({
  id: 'getZoneExample',
  description: '获取指定区域类型的黄金示例 JSON，如 filter, kpi-row, data-table',
  inputSchema: z.object({
    zoneType: z.string().describe('区域类型'),
  }),
  execute: async ({ context }) => {
    return { example: legacyZoneGoldenExamples[context.zoneType] };
  },
});
```

#### 方式 C：RAG 向量检索（推荐中期方案）

```typescript
// packages/mastra-runtime/src/rag/indexer.ts
import { MastraVector } from '@mastra/core';

export async function indexComponentKnowledge(vector: MastraVector) {
  // 1. 索引所有组件合约文档
  for (const doc of componentDocs) {
    await vector.upsert({
      id: `component-${doc.componentType}`,
      content: doc.markdown,
      metadata: {
        type: 'component-contract',
        componentType: doc.componentType,
        category: doc.category,
        groups: doc.groups,
      },
    });
  }

  // 2. 索引所有黄金示例
  for (const [zoneType, example] of Object.entries(goldenExamples)) {
    await vector.upsert({
      id: `example-${zoneType}`,
      content: `区域类型: ${zoneType}\n示例 JSON:\n${example}`,
      metadata: {
        type: 'zone-example',
        zoneType,
      },
    });
  }

  // 3. 索引布局模式
  for (const pattern of freeLayoutPatterns) {
    await vector.upsert({
      id: `layout-${pattern.id}`,
      content: `布局模式: ${pattern.title}\n${pattern.intent}\n${pattern.composition}`,
      metadata: {
        type: 'layout-pattern',
        pageTypes: pattern.appliesTo,
      },
    });
  }
}
```

### 5.2 Mastra Agent 配置示例

```typescript
// packages/mastra-runtime/src/agents/page-builder-agent.ts
import { Agent } from '@mastra/core';

export const pageBuilderAgent = new Agent({
  name: 'shenbi-page-builder',
  model: modelProvider,

  instructions: `
你是 Shenbi 低代码平台的页面生成助手。

## Schema 结构
每个页面是一个 PageSchema:
{ id: string, name?: string, body: SchemaNode[], dialogs?: SchemaNode[] }

SchemaNode 结构:
{ id: string, component: string, props?: object, children?: (SchemaNode|string)[], columns?: Column[], style?: object }

## 设计规范
${designPolicy}

## 可用组件分组
${plannerContractSummary}

## 重要约束
1. 只使用受支持的组件类型
2. 每个节点必须有唯一的 id
3. Form.Item 必须在 Form 内，Descriptions.Item 必须在 Descriptions 内
4. Table 使用 columns 属性定义列，不使用 children
5. 输出纯 JSON，不要包含注释或函数
  `,

  tools: {
    getComponentContract,
    listComponentsByGroup,
    getZoneExample,
    getPageSkeleton,
    validateSchemaNode,
  },
});
```

---

## 六、Gateway 知识注入设计

### 6.1 Gateway Schema 结构

Gateway 是流程编排的核心，其 Schema 与页面 Schema 不同：

```typescript
interface GatewayDocument {
  id: string;
  name: string;
  nodes: GatewayNode[];
  edges: GatewayEdge[];
}

interface GatewayNode {
  id: string;
  type: string;         // start, end, sql-query, condition, loop-start, ...
  position: { x: number; y: number };
  data: Record<string, unknown>;
}

interface GatewayEdge {
  id: string;
  source: string;       // 源节点 id
  target: string;       // 目标节点 id
  sourceHandle?: string;
  targetHandle?: string;
}
```

### 6.2 Gateway 节点合约文档

为每种 Gateway 节点创建知识文档：

```markdown
<!-- knowledge/gateway/nodes/sql-query.md -->
## sql-query 节点

**用途**: 执行 SQL 查询并返回结果集
**输入端口**: 1 个 (数据流入)
**输出端口**: 1 个 (数据流出)

### data 属性
| 属性 | 类型 | 必填 | 说明 |
|------|------|------|------|
| sql | string | ✅ | SQL 查询语句 |
| datasource | string | — | 数据源名称 |
| params | object | — | 查询参数 |

### 使用示例
{
  "id": "query-users",
  "type": "sql-query",
  "data": {
    "sql": "SELECT * FROM users WHERE status = :status",
    "params": { "status": "active" }
  }
}
```

### 6.3 Gateway Mastra Tool

```typescript
export const getGatewayNodeContract = createTool({
  id: 'getGatewayNodeContract',
  description: '查询 Gateway 节点类型的合约，包括端口、属性和示例',
  inputSchema: z.object({
    nodeType: z.string().describe('节点类型，如 sql-query, condition, loop-start'),
  }),
  execute: async ({ context }) => {
    return getGatewayNodeSpec(context.nodeType);
  },
});
```

---

## 七、创建页面 + 接口 + 表的联合知识设计

### 7.1 业务流程知识文档

```markdown
<!-- knowledge/workflows/full-project.md -->
## 完整项目创建流程

### 步骤
1. **分析需求** → 确定需要的页面、接口和数据表
2. **创建数据表** → 定义字段、类型、约束
3. **创建接口（Gateway）** → 基于数据表生成 CRUD 接口
4. **创建页面** → 基于接口数据模型生成 UI 页面
5. **绑定** → 将页面的表单/表格与接口绑定

### 数据流向
数据表 Schema → Gateway（接口） → 页面（UI）

### 约束
- 页面中的 Table columns 应与接口返回字段一致
- 表单中的 Form.Item 应与接口请求字段一致
- Gateway 的 sql-query 应引用正确的数据表和字段
```

### 7.2 联合 Workflow 示例

```typescript
const fullProjectWorkflow = new Workflow({ name: 'create-full-project' })
  .step(analyzeRequirementsStep)           // 分析需求
  .then(
    createTableStep.branch({               // 创建数据表
      hasTable: createTableStep,
      noTable: skipStep,
    })
  )
  .then(createGatewayStep)                  // 创建 Gateway 接口
  .then(createPageStep)                     // 创建页面
  .then(bindPageToGatewayStep)              // 绑定页面与接口
  .commit();
```

### 7.3 上下文传递设计

```typescript
// Workflow Step 之间传递的上下文
interface ProjectContext {
  // 需求分析结果
  requirements: {
    tables: TableSpec[];
    gateways: GatewaySpec[];
    pages: PageSpec[];
  };

  // 已创建的数据表
  createdTables: {
    tableId: string;
    columns: ColumnDef[];
  }[];

  // 已创建的 Gateway
  createdGateways: {
    gatewayId: string;
    endpoints: EndpointDef[];
  }[];

  // 已创建的页面
  createdPages: {
    pageId: string;
    schema: PageSchema;
  }[];
}
```

---

## 八、推荐实施路径

### Phase 0: 知识文档化（1-2 天）

1. 编写编译脚本，将 `builtinContracts` → Markdown 文档
2. 提取 `designPolicy` → `design-policy.md`
3. 提取 `pageSkeletons` → 页面类型文档
4. 提取 `legacyZoneGoldenExamples` → 区域示例 JSON 文件

### Phase 1: Tool-based 注入 + 单页生成（2-3 天）

1. 注册 `getComponentContract`、`listComponentsByGroup`、`getZoneExample` 等 Tools
2. 配置 Mastra Agent 的 System Prompt（设计策略 + Schema 规范）
3. 实现 page-create Workflow，验证生成的页面 JSON 是否符合 Schema 规范

### Phase 2: RAG 增强（2-3 天）

1. 选择向量数据库（推荐 LanceDB，零依赖本地部署）
2. 编写索引器，将知识文档索引到向量库
3. 在 Agent 中集成 RAG 检索，按需查询组件合约和示例

### Phase 3: Gateway 知识 + 联合流程（3-5 天）

1. 编写 Gateway 节点合约文档
2. 注册 Gateway 相关 Tools
3. 实现 Gateway 创建 Workflow
4. 实现 page + Gateway 联合 Workflow

---

## 九、关键设计决策

> [!IMPORTANT]
> **1. 初期优先 Tool-based 方式，不急于引入 RAG**
> — Tool 方式类型安全、可调试、零额外依赖。RAG 适合组件数量超过 LLM 上下文窗口时再引入。

> [!IMPORTANT]
> **2. 知识文档与代码合约保持同步**
> — 编写编译脚本自动从 `ComponentContract` 生成 Markdown 文档，避免手动维护导致的不一致。

> [!IMPORTANT]
> **3. 黄金示例是生成质量的关键**
> — 每种组件组合模式都应提供高质量的 JSON 示例，这比纯文字描述对 LLM 的引导效果好 10 倍以上。

> [!WARNING]
> **4. 不要把所有合约塞进 System Prompt**
> — 90+ 组件的合约超过 50K tokens。必须分层：System Prompt 放策略和规范，组件细节按需通过 Tool 或 RAG 获取。

---

## 十、AI 接口工具层设计（AI Tool Interface）

### 10.1 问题分析：当前耦合点

当前系统的 AI 能力直接硬编码在 `agent-runtime.ts` 中，没有统一的"工具接口"抽象。AI 调用的能力散落在各处：

| 现状 | 问题 |
|------|------|
| `planPage()` 直接调用 LLM | 无法被 Mastra Agent 复用 |
| `generateBlock()` 直接调用 LLM | 在 Mastra Workflow 中需要重写 |
| `assembleSchema()` 纯函数 | 没有注册为 Tool，Mastra Agent 无法调用 |
| `modifySchema()` 包含 LLM + 纯逻辑 | LLM 调用与业务逻辑混合，无法分离 |
| `classifyIntent()` 直接调用 LLM | 无法在 Mastra Agent 路由中复用 |

### 10.2 统一 AI Tool Interface 设计

将所有 AI 可调用的能力抽象为标准化的 Tool 接口，使其同时可被现有 runtime 和 Mastra runtime 调用：

```typescript
// packages/ai-tool-interface/src/types.ts

/**
 * 统一工具接口 — 所有 AI 可调用的能力都通过此接口暴露
 *
 * 设计原则：
 * 1. 每个 Tool 有明确的输入 Schema（Zod）和输出类型
 * 2. Tool 是纯函数或带副作用的异步函数，不包含 LLM 调用
 * 3. LLM 调用由 Agent/Workflow 层管理，Tool 只做业务逻辑
 */

export interface ToolDefinition<TInput, TOutput> {
  /** 工具唯一标识 */
  id: string;
  /** 工具名称（供 LLM 阅读） */
  name: string;
  /** 工具描述（供 LLM 理解何时使用） */
  description: string;
  /** 输入参数 Zod Schema */
  inputSchema: ZodType<TInput>;
  /** 输出类型 Zod Schema */
  outputSchema: ZodType<TOutput>;
  /** 执行函数 */
  execute: (input: TInput, context: ToolContext) => Promise<TOutput>;
}

export interface ToolContext {
  /** 当前页面 Schema */
  currentSchema?: PageSchema;
  /** 可用组件列表 */
  availableComponents?: ComponentContract[];
  /** 会话 ID */
  conversationId?: string;
  /** 信号（取消支持） */
  signal?: AbortSignal;
}
```

### 10.3 标准化 Tool 清单

将 `agent-runtime.ts` 中的 2100 行代码拆解为以下标准工具：

```
┌──────────────────────────────────────────────────────────────┐
│                    AI Tool Interface                          │
│                                                              │
│  ┌─ 知识查询类 ─────────────────────────────────────────┐    │
│  │  getComponentContract    查询组件合约                  │    │
│  │  listComponentsByGroup   按分组列出组件                │    │
│  │  getZoneExample          获取区域黄金示例              │    │
│  │  getPageSkeleton         获取页面骨架模板              │    │
│  │  getDesignPolicy         获取设计策略                  │    │
│  │  getGatewayNodeSpec     获取 Gateway 节点规格          │    │
│  └──────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌─ Schema 操作类 ──────────────────────────────────────┐    │
│  │  validateSchemaNode      校验 Schema 节点合法性        │    │
│  │  normalizeSchema         规范化 Schema 结构            │    │
│  │  repairSchema            修复 Schema 结构错误          │    │
│  │  assessBlockQuality      评估 Block 生成质量           │    │
│  │  assembleSchema          组装骨架+Block 为完整页面     │    │
│  └──────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌─ 编辑器操作类 ──────────────────────────────────────┐    │
│  │  applySchemaOperation    执行单个 Schema 操作         │    │
│  │  replacePageSchema       整体替换页面 Schema          │    │
│  │  insertSchemaNode        插入节点                      │    │
│  │  removeSchemaNode        删除节点                      │    │
│  │  patchNodeProps          修改节点属性                  │    │
│  └──────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌─ 文件/项目操作类 ────────────────────────────────────┐    │
│  │  createPage              创建新页面文件               │    │
│  │  createGateway           创建新 Gateway 文件          │    │
│  │  createTable             创建新数据表                 │    │
│  │  listProjectFiles        列出项目文件                 │    │
│  └──────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────┘
```

### 10.4 Tool Registry（注册中心）

```typescript
// packages/ai-tool-interface/src/registry.ts

export class AIToolRegistry {
  private tools = new Map<string, ToolDefinition<any, any>>();

  /** 注册工具 */
  register<TIn, TOut>(tool: ToolDefinition<TIn, TOut>): void {
    this.tools.set(tool.id, tool);
  }

  /** 获取工具 */
  get(id: string): ToolDefinition<any, any> | undefined {
    return this.tools.get(id);
  }

  /** 列出所有工具（供 LLM 查看） */
  listTools(): Array<{ id: string; name: string; description: string }> {
    return Array.from(this.tools.values()).map(t => ({
      id: t.id, name: t.name, description: t.description,
    }));
  }

  /** 导出为 Mastra Tools 格式 */
  toMastraTools(): Record<string, MastraTool> {
    const result: Record<string, MastraTool> = {};
    for (const [id, tool] of this.tools) {
      result[id] = createTool({
        id: tool.id,
        description: tool.description,
        inputSchema: tool.inputSchema,
        execute: async ({ context }) => tool.execute(context, {}),
      });
    }
    return result;
  }

  /** 导出为现有 runtime 格式 */
  toLegacyTools(): AgentTool[] {
    return Array.from(this.tools.values()).map(tool => ({
      name: tool.id,
      description: tool.description,
      execute: tool.execute,
    }));
  }
}
```

> [!TIP]
> **关键设计**：`AIToolRegistry` 同时支持导出为 Mastra 和 Legacy 两种格式，实现了一套 Tool 定义、两种 Runtime 共享。

---

## 十一、通用消息协议设计（Universal Message Protocol）

### 11.1 问题分析：Chat UI 的紧耦合现状

当前 `AgentEvent` 有 16 种事件类型，每种都硬编码了特定的业务语义：

```typescript
// 当前 AgentEvent 清单 — 与具体 Runtime 强绑定
type AgentEvent =
  | { type: 'run:start'; ... }        // 1. 运行开始
  | { type: 'intent'; ... }           // 2. 意图分类结果
  | { type: 'message:start'; ... }    // 3. 消息开始
  | { type: 'message:delta'; ... }    // 4. 流式文本片段
  | { type: 'tool:start'; ... }       // 5. 工具调用开始
  | { type: 'tool:result'; ... }      // 6. 工具调用结果
  | { type: 'plan'; ... }             // 7. 页面规划
  | { type: 'modify:start'; ... }     // 8. 修改开始
  | { type: 'modify:op:pending'; ... }// 9. 修改操作待执行
  | { type: 'modify:op'; ... }        // 10. 修改操作执行
  | { type: 'modify:done'; ... }      // 11. 修改完成
  | { type: 'schema:skeleton'; ... }  // 12. 骨架 Schema
  | { type: 'schema:block:start'; ... }// 13. Block 生成开始
  | { type: 'schema:block'; ... }     // 14. Block 生成完成
  | { type: 'schema:done'; ... }      // 15. 最终 Schema
  | { type: 'done'; ... }             // 16. 运行结束
  | { type: 'error'; ... }            // 17. 错误
```

**问题**：如果换用 Mastra 或其他 AI 模型，它们产出的事件格式完全不同。Chat UI 需要为每种 Runtime 写不同的消费逻辑。

### 11.2 通用消息协议设计

将消息协议分为 **两层**：

```
┌────────────────────────────────────────────────────┐
│ Layer 1: Universal Message Protocol (UMP)          │
│ — Chat UI 只消费这一层，与具体 Runtime 无关         │
│                                                    │
│  SessionMessage     会话生命周期                    │
│  TextMessage        流式文本内容                    │
│  ProgressMessage    通用进度更新                    │
│  ArtifactMessage    产物（Schema/Gateway/Table）    │
│  ActionMessage      需要用户交互的动作              │
│  ErrorMessage       错误信息                       │
│  MetadataMessage    运行统计元数据                  │
└────────────────────────────────────────────────────┘
            ▲                           ▲
            │                           │
┌───────────┴────────┐    ┌────────────┴──────────┐
│ Layer 2a: Legacy   │    │ Layer 2b: Mastra      │
│ Adapter            │    │ Adapter               │
│ AgentEvent → UMP   │    │ MastraEvent → UMP     │
└────────────────────┘    └───────────────────────┘
```

### 11.3 UMP 类型定义

```typescript
// packages/ai-contracts/src/universal-message.ts

/** 消息来源标识 */
export interface MessageSource {
  runtime: 'legacy' | 'mastra' | string;
  model?: string;
  provider?: string;
}

/** 会话生命周期消息 */
export type SessionMessage =
  | { kind: 'session'; action: 'start'; sessionId: string; conversationId?: string; source: MessageSource }
  | { kind: 'session'; action: 'end'; sessionId: string; source: MessageSource };

/** 流式文本消息 */
export interface TextMessage {
  kind: 'text';
  action: 'start' | 'delta' | 'end';
  role: 'assistant' | 'system';
  content?: string;        // delta 时为文本片段
  source: MessageSource;
}

/** 通用进度消息 — 替换 plan/tool:start/tool:result/等细粒度事件 */
export interface ProgressMessage {
  kind: 'progress';
  phase: string;           // 'planning' | 'generating' | 'modifying' | 'assembling' | ...
  label: string;           // 人类可读的进度文本，如 "正在生成 KPI 区块..."
  detail?: {
    current?: number;      // 当前步骤
    total?: number;        // 总步骤数
    blockId?: string;      // 关联的 Block ID
    toolName?: string;     // 关联的 Tool 名称
  };
  source: MessageSource;
}

/** 产物消息 — Schema、Gateway、Table 均统一为 Artifact */
export interface ArtifactMessage {
  kind: 'artifact';
  action: 'preview' | 'partial' | 'complete';
  artifactType: 'page-schema' | 'gateway' | 'table' | 'file';
  artifactId: string;
  data: unknown;            // PageSchema | GatewayDocument | TableDef | ...
  source: MessageSource;
}

/** 需要用户交互的消息 */
export interface ActionMessage {
  kind: 'action';
  actionType: 'confirm-plan' | 'select-option' | 'approve-modify' | 'input-required';
  prompt: string;           // 提示用户的文本
  options?: Array<{ id: string; label: string }>;
  payload?: unknown;        // 关联数据（如 ProjectPlan）
  source: MessageSource;
}

/** 错误消息 */
export interface ErrorMessage {
  kind: 'error';
  message: string;
  code?: string;
  recoverable?: boolean;
  source: MessageSource;
}

/** 元数据消息 */
export interface MetadataMessage {
  kind: 'metadata';
  metrics: {
    durationMs?: number;
    tokensUsed?: number;
    inputTokens?: number;
    outputTokens?: number;
  };
  debugFile?: string;
  source: MessageSource;
}

/** 统一消息类型 */
export type UniversalMessage =
  | SessionMessage
  | TextMessage
  | ProgressMessage
  | ArtifactMessage
  | ActionMessage
  | ErrorMessage
  | MetadataMessage;
```

### 11.4 适配器设计

#### Legacy → UMP 适配器

```typescript
// packages/ai-contracts/src/adapters/legacy-adapter.ts

const LEGACY_SOURCE: MessageSource = { runtime: 'legacy' };

export function adaptAgentEvent(event: AgentEvent): UniversalMessage[] {
  switch (event.type) {
    case 'run:start':
      return [{ kind: 'session', action: 'start', sessionId: event.data.sessionId,
                conversationId: event.data.conversationId, source: LEGACY_SOURCE }];

    case 'message:start':
      return [{ kind: 'text', action: 'start', role: 'assistant', source: LEGACY_SOURCE }];

    case 'message:delta':
      return [{ kind: 'text', action: 'delta', role: 'assistant',
                content: event.data.text, source: LEGACY_SOURCE }];

    case 'plan':
      return [
        { kind: 'progress', phase: 'planning', label: `页面规划完成：${event.data.pageTitle}`,
          detail: { total: event.data.blocks.length }, source: LEGACY_SOURCE },
        { kind: 'artifact', action: 'preview', artifactType: 'page-schema',
          artifactId: 'plan', data: event.data, source: LEGACY_SOURCE },
      ];

    case 'schema:skeleton':
      return [{ kind: 'artifact', action: 'preview', artifactType: 'page-schema',
                artifactId: 'skeleton', data: event.data.schema, source: LEGACY_SOURCE }];

    case 'schema:block':
      return [
        { kind: 'progress', phase: 'generating',
          label: `区块 ${event.data.blockId} 生成完成`,
          detail: { blockId: event.data.blockId }, source: LEGACY_SOURCE },
        { kind: 'artifact', action: 'partial', artifactType: 'page-schema',
          artifactId: event.data.blockId, data: event.data.node, source: LEGACY_SOURCE },
      ];

    case 'schema:done':
      return [{ kind: 'artifact', action: 'complete', artifactType: 'page-schema',
                artifactId: 'final', data: event.data.schema, source: LEGACY_SOURCE }];

    case 'modify:op':
      return [{ kind: 'progress', phase: 'modifying',
                label: `修改操作 ${event.data.index + 1}`,
                detail: { current: event.data.index + 1 }, source: LEGACY_SOURCE }];

    case 'done':
      return [
        { kind: 'metadata', metrics: {
            durationMs: event.data.metadata.durationMs,
            tokensUsed: event.data.metadata.tokensUsed,
          }, source: LEGACY_SOURCE },
        { kind: 'session', action: 'end',
          sessionId: event.data.metadata.sessionId, source: LEGACY_SOURCE },
      ];

    case 'error':
      return [{ kind: 'error', message: event.data.message,
                code: event.data.code, source: LEGACY_SOURCE }];

    default:
      return [];
  }
}
```

#### Mastra → UMP 适配器

```typescript
// packages/ai-contracts/src/adapters/mastra-adapter.ts

export function adaptMastraEvent(event: MastraWorkflowEvent): UniversalMessage[] {
  const source: MessageSource = {
    runtime: 'mastra',
    model: event.model,
    provider: event.provider,
  };

  switch (event.type) {
    case 'workflow.start':
      return [{ kind: 'session', action: 'start',
                sessionId: event.runId, source }];

    case 'step.start':
      return [{ kind: 'progress', phase: event.stepName,
                label: event.description ?? event.stepName,
                detail: { current: event.stepIndex, total: event.totalSteps },
                source }];

    case 'agent.text':
      return [{ kind: 'text', action: 'delta', role: 'assistant',
                content: event.text, source }];

    case 'step.output':
      if (event.outputType === 'page-schema') {
        return [{ kind: 'artifact', action: 'complete',
                  artifactType: 'page-schema',
                  artifactId: event.stepName,
                  data: event.output, source }];
      }
      if (event.outputType === 'gateway') {
        return [{ kind: 'artifact', action: 'complete',
                  artifactType: 'gateway',
                  artifactId: event.stepName,
                  data: event.output, source }];
      }
      return [];

    case 'workflow.complete':
      return [
        { kind: 'metadata', metrics: event.metrics, source },
        { kind: 'session', action: 'end', sessionId: event.runId, source },
      ];

    case 'workflow.error':
      return [{ kind: 'error', message: event.error, source }];

    default:
      return [];
  }
}
```

### 11.5 Chat UI 改造方案

```
改造前:
  AIPanel → useAgentRun → FetchAIClient → SSE(AgentEvent)
  AIPanel 直接处理 16 种 AgentEvent

改造后:
  AIPanel → useUniversalStream → AIStreamClient → SSE/WebSocket
                                     │
                          ┌──────────┴──────────┐
                          │ adaptAgentEvent()    │ (legacy runtime)
                          │ adaptMastraEvent()   │ (mastra runtime)
                          └─────────────────────┘
  AIPanel 只处理 7 种 UniversalMessage kind
```

Chat UI 组件只需响应 7 种消息类型：

```typescript
// packages/editor-plugins/ai-chat/src/hooks/useUniversalStream.ts

function handleMessage(msg: UniversalMessage) {
  switch (msg.kind) {
    case 'session':
      // start/end 管理会话状态
      break;
    case 'text':
      // start/delta/end 渲染 AI 文字
      break;
    case 'progress':
      // 渲染进度条、当前步骤名、百分比
      // 通过 msg.phase 区分生成/修改/规划
      break;
    case 'artifact':
      // preview → 骨架预览
      // partial → 增量 Block 更新
      // complete → 最终产物
      // 通过 msg.artifactType 区分 page/gateway/table
      break;
    case 'action':
      // 显示确认对话框、选项列表等
      break;
    case 'error':
      // 显示错误提示
      break;
    case 'metadata':
      // 更新运行统计
      break;
  }
}
```

### 11.6 关键优势

| 维度 | 改造前 | 改造后 |
|------|-------|--------|
| **新增 AI Runtime** | 需修改 UI 来消费新事件格式 | 只需写一个适配器函数 |
| **新增产物类型**（如 Gateway） | 需新增 `gateway:*` 事件 + UI 处理 | `ArtifactMessage` 的 `artifactType` 扩展即可 |
| **事件类型数量** | 16 种 | 7 种 kind（更通用） |
| **多模型对比** | 不支持 | `source.runtime/model` 标识来源，可并排展示 |
| **前端代码量** | `useAgentRun` 569 行 + `useAgentLoop` 1466 行 | 精简为 `useUniversalStream` ~200 行 + 产物处理器 |

> [!IMPORTANT]
> **迁移策略**：不需要一次性全部改造。可以先在 `useAgentRun` 内部增加一层 `adaptAgentEvent()` 转换，让 UI 逐步切换到消费 `UniversalMessage`，同时保持现有逻辑完全不变。

---

## 十二、AI 生成效果评估体系

### 12.1 现有评估机制

当前系统已有一套**规则式质量检测**（`assessBlockQuality`，约 170 行），在每次 Block 生成后立即执行：

| 现有规则 | 检测内容 | 触发条件 |
|---------|---------|---------|
| `alert-missing-copy` | Alert 组件缺少 message/description | 所有 Block |
| `button-missing-text` | Button 缺少可见文本 | 筛选区域/操作区域严格，其他区域警告 |
| `filter-inline-overflow` | 筛选区 inline 布局字段过多或含 RangePicker | 筛选类 Block |
| `filter-actions-mixed-with-fields` | 操作按钮与字段混排在同一行 | 筛选类 Block |
| `filter-vertical-stacked-layout` | 2-3 个字段的筛选区不应使用竖排布局 | 筛选类 Block |
| `kpi-too-many-cards` | KPI 行超过 4 张卡片 | KPI 类 Block |
| `kpi-tag-only-card` | KPI 卡片只有 Tag 没有主值 | KPI 类 Block |
| `kpi-mixed-card-structures` | KPI 行内卡片结构不统一 | KPI 类 Block |
| `tabs-overcrowded-pane` | Tab 面板内 Alert 或 Card 过多 | Tabs 类 Block |

**局限性**：
- 只覆盖了部分组件模式，无法评估整体页面质量
- 纯规则式，无法捕捉语义层面的质量问题（如"页面是否符合用户意图"）
- 没有评分机制，只有 pass/warn/retry 三档

### 12.2 Mastra 内置评估框架

Mastra 提供了 **完整的 AI 评估体系**（`@mastra/evals`），设计精良：

#### 评估流水线（4 步架构）

```
Input/Output → Preprocess → Analyze (LLM) → Score (0~1) → Reason (文字解释)
```

#### 内置 Scorer 分类

| 类别 | Scorer | 说明 | 是否需要 LLM |
|------|--------|------|-------------|
| **准确性** | Answer Relevancy | 回答是否切题 | ✅ LLM |
| | Completeness | 回答是否完整覆盖要点 | NLP |
| | Faithfulness | 是否忠于上下文 | ✅ LLM |
| | Hallucination | 是否产生幻觉/编造事实 | ✅ LLM |
| | Answer Similarity | 与标准答案的语义相似度 | NLP |
| **工具** | Tool Call Accuracy | 是否正确选择了工具 | NLP |
| **合规** | Prompt Alignment | 是否遵循 prompt 指令 | ✅ LLM |
| | Tone Consistency | 语气一致性 | ✅ LLM |
| | Toxicity | 有害内容检测 | ✅ LLM |
| | Bias | 偏见检测 | ✅ LLM |
| **上下文** | Context Precision | 上下文排列质量 | ✅ LLM |
| | Context Relevance | 上下文相关度 | ✅ LLM |
| **文本** | Keyword Coverage | 术语覆盖率 | NLP |
| | Textual Difference | 文本差异度 | NLP |

#### 使用方式

```typescript
import { Agent } from '@mastra/core';
import { PromptAlignmentMetric, CompletenessMetric } from '@mastra/evals';

const agent = new Agent({
  name: 'page-builder',
  model: modelProvider,
  evals: {
    promptAlignment: new PromptAlignmentMetric(judgeModel),
    completeness: new CompletenessMetric(),
  },
});

// 评估自动在 agent.generate() 后运行
// 结果可通过 Mastra Playground 可视化查看
```

### 12.3 Shenbi 低代码场景的定制评估方案

Mastra 的通用 Scorer 不够覆盖低代码场景。需要设计**领域定制 Scorer**：

#### 评估维度矩阵

```
┌──────────────────────────────────────────────────────────┐
│                   评估维度矩阵                            │
│                                                          │
│  L1 结构合规层 (规则式, 不需要 LLM)                       │
│    ├─ Schema 结构合法性（JSON valid, 必填字段完整）       │
│    ├─ 组件约束合规性（Form.Item∈Form, 只用支持的组件）   │
│    ├─ ID 唯一性                                          │
│    └─ 当前 assessBlockQuality 规则集                      │
│                                                          │
│  L2 设计质量层 (规则+统计, 不需要 LLM)                   │
│    ├─ 布局合理性（嵌套深度、节点数量、留白均衡）         │
│    ├─ 组件多样性（是否大量重复单一组件）                 │
│    ├─ 信息层级清晰度（标题→正文→辅助 的层级结构）       │
│    └─ 设计策略符合度（20 条规范的逐条检查）              │
│                                                          │
│  L3 语义匹配层 (需要 LLM Judge)                          │
│    ├─ Prompt 意图匹配度（生成结果是否满足用户描述）      │
│    ├─ 业务合理性（字段命名、数据结构是否合乎业务）       │
│    └─ 中文文案质量（标题、描述、占位符的用词质量）       │
│                                                          │
│  L4 对比回归层 (需要基线数据)                            │
│    ├─ A/B 对比（Legacy vs Mastra 生成结果对比）          │
│    ├─ 历史回归（同一 prompt 不同版本的质量趋势）         │
│    └─ 模型对比（不同模型的生成质量排名）                 │
└──────────────────────────────────────────────────────────┘
```

### 12.4 自定义 Mastra Scorer 实现

#### L1: Schema 结构合规 Scorer

```typescript
// packages/mastra-runtime/src/evals/schema-compliance-scorer.ts
import { createMetric } from '@mastra/evals';

export const schemaComplianceMetric = createMetric({
  name: 'schema-compliance',
  description: '检查生成的 Schema JSON 是否结构合规',

  // 不需要 LLM，纯规则检查
  async score({ output }) {
    const schema = JSON.parse(output);
    const checks = [
      checkRequiredFields(schema),        // id, component 必填
      checkIdUniqueness(schema),          // ID 不重复
      checkSupportedComponents(schema),   // 只用支持的组件
      checkParentChildRules(schema),      // Form.Item∈Form 等
      checkNoFunctions(schema),           // 不含函数/箭头函数
    ];

    const passed = checks.filter(c => c.pass).length;
    return {
      score: passed / checks.length,
      reason: checks.filter(c => !c.pass).map(c => c.message).join('; '),
    };
  },
});
```

#### L2: 设计质量 Scorer

```typescript
export const designQualityMetric = createMetric({
  name: 'design-quality',
  description: '评估页面设计质量（布局、层级、组件使用）',

  async score({ output }) {
    const schema = JSON.parse(output);
    const scores = {
      nestingDepth: scoreNestingDepth(schema),     // 嵌套深度 ≤ 5 为优
      nodeCount: scoreNodeCount(schema),            // 节点数在合理范围
      componentDiversity: scoreDiversity(schema),   // 组件种类丰富度
      hierarchyClarity: scoreHierarchy(schema),     // 标题→正文→辅助 层次
      blockQuality: scoreExistingRules(schema),     // 现有 assessBlockQuality
    };

    const weights = { nestingDepth: 0.15, nodeCount: 0.15,
                      componentDiversity: 0.2, hierarchyClarity: 0.2,
                      blockQuality: 0.3 };

    const total = Object.entries(scores).reduce(
      (sum, [key, val]) => sum + val * weights[key], 0
    );

    return { score: total, reason: formatScoreBreakdown(scores) };
  },
});
```

#### L3: 意图匹配 Scorer（LLM Judge）

```typescript
export const intentMatchMetric = createMetric({
  name: 'intent-match',
  description: '使用 LLM 评估生成结果是否匹配用户意图',

  // 需要 LLM 作为 judge
  async score({ input, output, model }) {
    const result = await model.generate(`
你是低代码页面质量评审员。请根据以下维度为生成结果打分（0-1）：

## 用户需求
${input}

## 生成的页面 Schema（摘要）
${summarizeSchemaForJudge(output)}

## 评分维度
1. 意图匹配度：生成结果是否包含用户描述的全部功能模块？
2. 业务合理性：字段名、标签、数据结构是否合乎业务场景？
3. 中文文案质量：标题、描述、占位符用词是否专业自然？
4. 布局合理性：信息组织是否清晰、层级分明？

返回 JSON: { "score": 0.85, "breakdown": {...}, "reason": "..." }
    `);

    return JSON.parse(result.content);
  },
});
```

### 12.5 评估流水线

#### 在线评估（实时）

每次生成后自动执行，结果附加到 `MetadataMessage` 中：

```
用户输入 prompt
    │
    ▼
AI 生成 Schema JSON
    │
    ├──► L1 结构合规检查 (< 10ms)
    │    └─ 不通过 → 触发 repairSchema 自动修复 → 重新检查
    │
    ├──► L2 设计质量打分 (< 50ms)
    │    └─ 分数 < 0.6 → 触发 retry（最多 1 次）
    │
    └──► L3 意图匹配打分 (异步, ~2s)
         └─ 分数附加到运行元数据，不阻塞用户

评估结果随 MetadataMessage 发送给前端:
{ kind: 'metadata', metrics: { ..., quality: { L1: 0.95, L2: 0.78, L3: 0.82 } } }
```

#### 离线评估（批量回归）

用于版本发布前的质量把关和模型对比：

```typescript
// scripts/run-evals.ts
import { TestSuite } from '@mastra/evals';

const suite = new TestSuite({
  name: 'page-generation-regression',
  agents: {
    legacy: legacyPageBuilder,
    mastra: mastraPageBuilder,
  },
  cases: [
    { input: '创建一个用户管理列表页', expectedType: 'list' },
    { input: '创建一个销售数据仪表盘', expectedType: 'dashboard' },
    { input: '创建一个员工信息录入表单', expectedType: 'form' },
    // ... 已有 LLM 测试用例 (packages/schema/tests/llm-gen/cases/)
  ],
  metrics: [
    schemaComplianceMetric,
    designQualityMetric,
    intentMatchMetric,
  ],
});

// 运行并输出对比报告
const results = await suite.run();
// 输出:
// ┌──────────────────────┬────────────┬────────────┐
// │ Test Case            │ Legacy     │ Mastra     │
// ├──────────────────────┼────────────┼────────────┤
// │ 用户管理列表页       │ L1:0.95    │ L1:0.97    │
// │                      │ L2:0.72    │ L2:0.81    │
// │                      │ L3:0.80    │ L3:0.85    │
// ├──────────────────────┼────────────┼────────────┤
// │ 销售数据仪表盘       │ L1:0.90    │ L1:0.95    │
// │                      │ L2:0.68    │ L2:0.75    │
// │                      │ L3:0.78    │ L3:0.82    │
// └──────────────────────┴────────────┴────────────┘
```

### 12.6 用户反馈闭环

```
┌─────────────────────────────────────────────────────┐
│    用户反馈 → 改进闭环                               │
│                                                     │
│  ① 生成完成后，Chat UI 显示评估分数                  │
│     "质量评分：结构 95% · 设计 78% · 意图匹配 82%"  │
│                                                     │
│  ② 用户可点击 👍/👎 给出反馈                         │
│     (现有 FeedbackRequest 接口)                      │
│                                                     │
│  ③ 带评分数据的反馈存入数据库                        │
│     { prompt, schema, L1, L2, L3, userRating }      │
│                                                     │
│  ④ 定期分析反馈数据                                  │
│     - 低分 prompt 模式 → 补充训练样本/调整策略       │
│     - 高分 prompt 模式 → 提取为黄金示例              │
│     - 用户评分 vs AI评分 差异 → 校准评估指标         │
└─────────────────────────────────────────────────────┘
```

### 12.7 与现有方案的对比

| 维度 | 当前方案 | Mastra 评估方案 |
|------|---------|----------------|
| 结构检查 | `assessBlockQuality` ~170 行规则 | 保留并包装为 L1 Scorer |
| 设计质量 | 无 | 新增 L2 Scorer（统计式） |
| 意图匹配 | 无 | 新增 L3 Scorer（LLM Judge） |
| 对比评估 | 无 | TestSuite 批量回归对比 |
| 可视化 | trace dump JSON 文件 | Mastra Playground 可视化 |
| CI 集成 | 有 LLM 测试用例 | 复用测试用例 + 自动化评分 |
| 用户反馈 | `FeedbackRequest` 简单评分 | 评分+质量数据+闭环改进 |

> [!TIP]
> **立即可执行**：将现有 `assessBlockQuality` 规则包装为 Mastra L1 Scorer，再复用 `packages/schema/tests/llm-gen/cases/` 的 1000+ 测试用例作为 TestSuite 基线，就能快速建立起 Legacy vs Mastra 的对比评估体系。

