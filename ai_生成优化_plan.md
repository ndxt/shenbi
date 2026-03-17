# AI 生成质量提升：二次修改 + 文档生成

## 问题背景

用户反馈两个核心痛点：
1. **二次修改时 LLM 无法领会意图** — 与写死的 action 类型有关
2. **文档生成项目时缺少目录结构且页面细节不够** — LLM 没有很好地从文档中提取每个页面的构造内容

---

## 痛点一：二次修改意图理解差

### 根因分析

通过分析 [modify-schema.ts](file:///c:/Users/zhang/Code/LowCode/shenbi-codes/shenbi/apps/ai-api/src/runtime/modify-schema.ts) 中的 [createPlanMessages](file:///c:/Users/zhang/Code/LowCode/shenbi-codes/shenbi/apps/ai-api/src/runtime/modify-schema.ts#511-585) (L511-L584)，发现以下问题：

#### 1. Schema Tree 信息不足

当前给 LLM 的 Schema Tree 只包含节点 ID 和组件类型（如 `Card#card-1`），**不包含 props 值、children 文本内容**。LLM 看到 `Card#card-1` 但不知道这个 Card 的 title 是什么、里面写了什么内容，自然无法理解用户说的"把那个标题改一下"指的是什么。

#### 2. 操作类型受限但不是主要问题

7 种操作类型（`patchProps/patchStyle/patchEvents/patchLogic/patchColumns/insertNode/removeNode`+ [replace](file:///c:/Users/zhang/Code/LowCode/shenbi-codes/shenbi/packages/editor-plugins/ai-chat/src/hooks/useAgentLoop.ts#580-583)）覆盖面其实已经足够。问题不在操作种类少，而在于 **LLM 看不到足够的上下文来做出正确判断**。

#### 3. 对话历史压缩过度

[conversation-history.ts](file:///c:/Users/zhang/Code/LowCode/shenbi-codes/shenbi/packages/ai-agents/src/context/conversation-history.ts) 的 `formatConversationHistory` 给 LLM 的上下文可能不够，导致跨轮次修改时 LLM 丢失了上一次做了什么的记忆。

### 修改方案

#### [MODIFY] [modify-schema.ts](file:///c:/Users/zhang/Code/LowCode/shenbi-codes/shenbi/apps/ai-api/src/runtime/modify-schema.ts)

**改动 1：富化 Schema Tree —— 在 system prompt 中增加指引**

在 [createPlanMessages](file:///c:/Users/zhang/Code/LowCode/shenbi-codes/shenbi/apps/ai-api/src/runtime/modify-schema.ts#511-585) 的 system prompt 中增加规则：

```diff
 '- Do not invent node ids that are not grounded in the schema tree.',
+
+'## Schema Tree 阅读指南',
+'Schema Tree 中每个节点格式为：',
+'  组件类型#节点ID [props摘要] "文本内容"',
+'例如：Card#card-1 [title="本月营收"] > Statistic#stat-1 [value=12345]',
+'根据这些信息准确定位用户提到的组件。',
```

**改动 2：生成 Rich Schema Tree 工具函数**

新增一个 `buildRichSchemaTree` 函数，替代当前只输出 `Card#card-1` 的简化 tree。新 tree 包含：
- 组件类型 + ID
- **关键 props 摘要**（title、placeholder、label、dataSource 等常用属性的值）
- **文本 children 内容**（截断到 50 字符）
- 嵌套深度缩进

示例输出：
```
Card#card-1 [title="本月营收概览"]
  Row#row-1
    Col#col-1 [span=8]
      Statistic#stat-1 [title="总营收" value="{{state.totalRevenue}}"]
    Col#col-2 [span=8]
      Statistic#stat-2 [title="订单数" value="{{state.orderCount}}"]
  Table#table-1 [bordered=true]
    columns: [序号, 项目名称, 金额, 状态, 操作]
```

---

#### [NEW] `buildRichSchemaTree` 函数

位置：在 [modify-schema.ts](file:///c:/Users/zhang/Code/LowCode/shenbi-codes/shenbi/apps/ai-api/src/runtime/modify-schema.ts) 内新增，或提取到独立工具文件中。

核心逻辑：
1. 递归遍历 SchemaNode 树
2. 对每个节点提取：`component`, [id](file:///c:/Users/zhang/Code/LowCode/shenbi-codes/shenbi/packages/editor-plugins/ai-chat/src/hooks/useAgentLoop.ts#112-113), 关键 props (title, placeholder, label, value, dataSource, columns 摘要, dataIndex)
3. 如果 children 是纯文本（string），截断输出
4. 缩进层级

**为什么有效**：LLM 看到 `Statistic#stat-1 [title="总营收"]` 就能理解用户说"把总营收改成净利润"指的是哪个节点。

---

#### [MODIFY] [createPlanMessages](file:///c:/Users/zhang/Code/LowCode/shenbi-codes/shenbi/apps/ai-api/src/runtime/modify-schema.ts#511-585) 中增加 `schemaDigest` 参数

将 `schemaDigest`（如果存在）也作为上下文传给 LLM：

```diff
- 'Schema Tree:',
- documentTree,
+ 'Schema Tree (with prop summaries):',
+ richSchemaTree,  // 用新的 buildRichSchemaTree 替代
```

> [!IMPORTANT]
> 这里需要看一下当前 `documentTree` 是怎么生成的 —— 它来自 `input.context.document.tree`。我们需要在生成 tree 的上游（即 `buildEditorTree` 或 stream-agent 中的 context 构建逻辑）改成 rich tree，**或者**在 [modify-schema.ts](file:///c:/Users/zhang/Code/LowCode/shenbi-codes/shenbi/apps/ai-api/src/runtime/modify-schema.ts) 中直接从 `schemaJson` 重新生成 rich tree。后者更简单且不影响其他流程。
>
> 推荐方案：在 [modify-schema.ts](file:///c:/Users/zhang/Code/LowCode/shenbi-codes/shenbi/apps/ai-api/src/runtime/modify-schema.ts) 的 [createPlanMessages](file:///c:/Users/zhang/Code/LowCode/shenbi-codes/shenbi/apps/ai-api/src/runtime/modify-schema.ts#511-585) 中，从 `input.request.context.schemaJson` 直接生成 rich tree，忽略上游的 `document.tree`。

---

## 痛点二：文档生成项目缺少目录结构且页面细节不够

### 根因分析

通过分析链路：`classifyRoute` → `prepareRunRequest`（嵌入文档文本）→ [useAgentLoop](file:///c:/Users/zhang/Code/LowCode/shenbi-codes/shenbi/packages/editor-plugins/ai-chat/src/hooks/useAgentLoop.ts#292-1426)（系统 prompt + 用户消息）→ LLM → `proposeProjectPlan` → `createPage`，发现以下问题：

#### 1. Agent Loop System Prompt 缺少文档分析指引

[agent-tools.ts](file:///c:/Users/zhang/Code/LowCode/shenbi-codes/shenbi/packages/editor-plugins/ai-chat/src/ai/agent-tools.ts) 的 [buildAgentLoopSystemPrompt](file:///c:/Users/zhang/Code/LowCode/shenbi-codes/shenbi/packages/editor-plugins/ai-chat/src/ai/agent-tools.ts#178-218)（L178-L217）只有通用规则（如"先 listWorkspaceFiles"、"先 proposeProjectPlan"），**没有告诉 LLM 如何从文档中系统性地提取页面结构**。

#### 2. `proposeProjectPlan` 的 pages 字段太简单

当前 `ProjectPlan.pages` 只有 `pageId`, `pageName`, `action`, `description`。没有字段来容纳：
- **页面目录/分组结构**（如"系统管理"模块下有"用户管理"、"角色管理"）
- **页面具体构造要素**（字段列表、交互逻辑、数据源等）

#### 3. `createPage` prompt 丢失上下文

[buildCreatePagePrompt](file:///c:/Users/zhang/Code/LowCode/shenbi-codes/shenbi/packages/editor-plugins/ai-chat/src/ai/agent-tools.ts#55-103)（L55-L102）只是把 description/layout/components/fields/interactions 简单拼接。但从 LLM 到 `proposeProjectPlan` 再到 `createPage`，**原始文档内容在这个过程中被丢失了**。LLM 在 proposeProjectPlan 时见过文档全文，但 createPage 时只拿到了 LLM 压缩后的一行 description。

### 修改方案

#### [MODIFY] [agent-tools.ts](file:///c:/Users/zhang/Code/LowCode/shenbi-codes/shenbi/packages/editor-plugins/ai-chat/src/ai/agent-tools.ts) — [buildAgentLoopSystemPrompt](file:///c:/Users/zhang/Code/LowCode/shenbi-codes/shenbi/packages/editor-plugins/ai-chat/src/ai/agent-tools.ts#178-218)

在系统 prompt 中新增文档分析指引：

```diff
 '7. createPage / modifyPage 的 actionInput 必须包含 pageId 或 fileId、pageName，以及足够具体的 description 或 prompt。',
+'',
+'## 文档分析规则',
+'当用户上传了需求文档时：',
+'1. 仔细阅读文档中的功能模块、页面列表、字段说明、权限要求等内容。',
+'2. proposeProjectPlan 时：',
+'   - pages 按功能模块分组（用 group 字段标识所属模块，如"系统管理"、"业务管理"）。',
+'   - 每个 page 的 description 必须详细包含：页面目标、核心功能点、关键数据字段、交互逻辑。',
+'   - 不要遗漏文档中提到的任何页面或功能模块。',
+'3. createPage 的 actionInput 中 prompt 字段必须包含足够细节：',
+'   - 必须列出所有数据字段（字段名、类型、是否必填）。',
+'   - 必须描述表格列结构（如果有表格）。',
+'   - 必须描述筛选/搜索条件（如果有）。',
+'   - 必须描述表单结构和校验规则（如果有表单）。',
+'   - 必须描述操作按钮和交互逻辑（新增、编辑、删除、导出等）。',
+'   - 引用文档中的原文来支撑细节。',
```

---

#### [MODIFY] [agent-tools.ts](file:///c:/Users/zhang/Code/LowCode/shenbi-codes/shenbi/packages/editor-plugins/ai-chat/src/ai/agent-tools.ts) — [toProjectPlan](file:///c:/Users/zhang/Code/LowCode/shenbi-codes/shenbi/packages/editor-plugins/ai-chat/src/ai/agent-tools.ts#35-54)

扩展 [ProjectPlan](file:///c:/Users/zhang/Code/LowCode/shenbi-codes/shenbi/packages/editor-plugins/ai-chat/src/ai/agent-tools.ts#35-54) 类型以支持目录分组：

```diff
 return {
   pageId: ...,
   pageName: ...,
   action: ...,
   description: ...,
+  group: typeof record.group === 'string' && record.group.trim() ? record.group.trim() : undefined,
+  prompt: typeof record.prompt === 'string' && record.prompt.trim() ? record.prompt.trim() : undefined,
 };
```

---

#### [MODIFY] [api-types.ts](file:///c:/Users/zhang/Code/LowCode/shenbi-codes/shenbi/packages/editor-plugins/ai-chat/src/ai/api-types.ts) 或 [ai-contracts](file:///c:/Users/zhang/Code/LowCode/shenbi-codes/shenbi/packages/ai-contracts/src/index.ts) — 扩展 [ProjectPlan](file:///c:/Users/zhang/Code/LowCode/shenbi-codes/shenbi/packages/editor-plugins/ai-chat/src/ai/agent-tools.ts#35-54) 类型

```typescript
interface ProjectPlanPage {
  pageId: string;
  pageName: string;
  action: 'create' | 'modify' | 'skip';
  description: string;
  group?: string;       // 所属功能模块/目录分组
  prompt?: string;      // 详细的页面构造 prompt（比 description 更详细）
  reason?: string;
}
```

---

#### [MODIFY] [agent-tools.ts](file:///c:/Users/zhang/Code/LowCode/shenbi-codes/shenbi/packages/editor-plugins/ai-chat/src/ai/agent-tools.ts) — [buildCreatePagePrompt](file:///c:/Users/zhang/Code/LowCode/shenbi-codes/shenbi/packages/editor-plugins/ai-chat/src/ai/agent-tools.ts#55-103)

让 `createPage` 优先使用 plan 中的详细 prompt：

```diff
 function buildCreatePagePrompt(actionInput: Record<string, unknown>, pageName: string): string {
   if (typeof actionInput.prompt === 'string' && actionInput.prompt.trim()) {
     return actionInput.prompt.trim();
   }
+  // 检查是否有来自 proposeProjectPlan 的详细描述
+  if (typeof actionInput.detailedPrompt === 'string' && actionInput.detailedPrompt.trim()) {
+    return actionInput.detailedPrompt.trim();
+  }
```

---

#### [MODIFY] [agent-tools.ts](file:///c:/Users/zhang/Code/LowCode/shenbi-codes/shenbi/packages/editor-plugins/ai-chat/src/ai/agent-tools.ts) — [buildAgentLoopSystemPrompt](file:///c:/Users/zhang/Code/LowCode/shenbi-codes/shenbi/packages/editor-plugins/ai-chat/src/ai/agent-tools.ts#178-218) 示例改进

改进 system prompt 中的 `proposeProjectPlan` 示例，展示详细的页面描述：

```diff
-'{\"action\":\"createPage\",\"actionInput\":{\"pageId\":\"order-list\",\"pageName\":\"订单列表页\",\"description\":\"展示订单列表、筛选和分页\"}}',
+'{\"action\":\"createPage\",\"actionInput\":{\"pageId\":\"order-list\",\"pageName\":\"订单列表页\",\"prompt\":\"订单列表页。\\n目标: 展示所有订单的列表视图，支持筛选、搜索和分页。\\n筛选: 订单状态下拉(待支付/已支付/已发货/已完成/已取消)、日期范围选择器、关键词搜索框。\\n表格列: 订单编号、客户名称、商品名称、订单金额(元)、下单时间、订单状态(Tag)、操作(查看详情/编辑/删除)。\\n操作: 顶部新建订单按钮，表格行内查看/编辑/删除链接按钮。\\n分页: 底部分页器，每页20条。\"}}',
```

---

## User Review Required

> [!IMPORTANT]
> **痛点一和痛点二是独立的**，可以分别实施。建议先做痛点一（rich schema tree），因为改动更聚焦、效果可以立即验证。

> [!WARNING]
> 痛点二的 system prompt 改进需要实际测试效果。不同 LLM 对 prompt 指引的遵循度不同。建议先用你常用的模型测试几个真实文档，根据效果迭代 prompt。

---

## Proposed Changes

### 痛点一：Rich Schema Tree

---

#### [MODIFY] [modify-schema.ts](file:///c:/Users/zhang/Code/LowCode/shenbi-codes/shenbi/apps/ai-api/src/runtime/modify-schema.ts)

1. 新增 `buildRichSchemaTree(schemaJson)` 函数：从 `PageSchema` 递归生成带 props 摘要的 tree 字符串
2. 修改 [createPlanMessages](file:///c:/Users/zhang/Code/LowCode/shenbi-codes/shenbi/apps/ai-api/src/runtime/modify-schema.ts#511-585)：用 rich tree 替代上游传入的简化 tree
3. 在 system prompt 中增加 Schema Tree 阅读指南

---

### 痛点二：文档分析与目录结构

---

#### [MODIFY] [agent-tools.ts](file:///c:/Users/zhang/Code/LowCode/shenbi-codes/shenbi/packages/editor-plugins/ai-chat/src/ai/agent-tools.ts)

1. [buildAgentLoopSystemPrompt](file:///c:/Users/zhang/Code/LowCode/shenbi-codes/shenbi/packages/editor-plugins/ai-chat/src/ai/agent-tools.ts#178-218)：增加文档分析规则和更详细的 `createPage` 示例
2. [toProjectPlan](file:///c:/Users/zhang/Code/LowCode/shenbi-codes/shenbi/packages/editor-plugins/ai-chat/src/ai/agent-tools.ts#35-54)：支持 `group` 和 `prompt` 字段
3. [buildCreatePagePrompt](file:///c:/Users/zhang/Code/LowCode/shenbi-codes/shenbi/packages/editor-plugins/ai-chat/src/ai/agent-tools.ts#55-103)：优先使用 `prompt` 字段

#### [MODIFY] [api-types.ts](file:///c:/Users/zhang/Code/LowCode/shenbi-codes/shenbi/packages/editor-plugins/ai-chat/src/ai/api-types.ts) 或 `@shenbi/ai-contracts`

扩展 `ProjectPlanPage` 类型

---

## Verification Plan

### 自动化测试

**痛点一：Rich Schema Tree**

```bash
# 在 modify-schema.test.ts 中新增测试用例验证 buildRichSchemaTree 输出
cd apps/ai-api && npx vitest run src/runtime/modify-schema.test.ts
```

新增测试：
- 测试 `buildRichSchemaTree` 对一个包含 Card/Statistic/Table/Form 的复杂 schema 的输出格式
- 确认 props 摘要包含 title/placeholder/label 等关键属性
- 确认文本 children 被截断输出
- 确认 columns 的列名列表被输出

**痛点二：Agent Loop System Prompt**

```bash
# agent-tools.test.ts 已有测试
cd packages/editor-plugins/ai-chat && npx vitest run src/ai/agent-tools.test.ts
```

新增测试：
- 测试 [toProjectPlan](file:///c:/Users/zhang/Code/LowCode/shenbi-codes/shenbi/packages/editor-plugins/ai-chat/src/ai/agent-tools.ts#35-54) 正确解析 `group` 和 `prompt` 字段
- 测试 [buildCreatePagePrompt](file:///c:/Users/zhang/Code/LowCode/shenbi-codes/shenbi/packages/editor-plugins/ai-chat/src/ai/agent-tools.ts#55-103) 优先使用 `prompt` 字段

### 手动验证

> [!IMPORTANT]
> 这两个改动的核心价值在于 LLM 行为的改善，自动化测试只能验证数据结构正确。**必须做手动测试**来验证 LLM 是否真的能更好理解意图。

**痛点一测试步骤**：
1. 打开一个有内容的页面（如包含 Card + Statistic + Table 的看板页面）
2. 修改请求："把营收统计的标题改成本月净利润"
3. 验证 LLM 是否能准确定位到正确的 Statistic 节点
4. 再试："把表格的第三列标题改成'金额(元)'"
5. 验证是否准确作用到正确的列

**痛点二测试步骤**：
1. 上传一份包含多个功能模块的需求文档（如"考勤管理系统需求"）
2. 输入"根据文档生成所有页面"
3. 在 ProjectPlanCard 中检查：
   - 页面是否有按功能模块分组展示
   - 每个页面的 description 是否包含了文档中的详细字段信息
4. 确认后检查生成的页面质量：
   - 表格是否包含了文档中提到的所有列
   - 表单是否包含了文档中提到的所有字段
   - 筛选条件是否齐全
