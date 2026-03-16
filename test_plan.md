# 组件契约 & LLM 生成质量测试计划（v2）

## 目标

建立两层测试体系，将"玄学的 LLM 生成"变成**可量化、可回归**的工程化质量保障：

1. **Layer 1 — 契约正确性**：确保 ~100 个组件契约与 Ant Design 6.x 官方 API 对齐
2. **Layer 2 — LLM 生成质量**：通过现有 `ai-agents` 生成管线（`planPage` → `generateBlock` → `assembleSchema` → `repairSchema`），用最小 prompt 生成 Schema，自动校验结果

---

## Layer 1：契约正确性测试

### 1.1 Snapshot 锁定

遍历 `builtinContracts`，对每个组件 snapshot 其 prop keys / event keys / slot keys。任何契约字段增删都会触发 snapshot 失败 → 强制 review。

### 1.2 Ant Design 6.x 官方对齐

维护 `antd-api-golden.json`（从 https://ant.design/index-cn 提取的 props/events），与契约 diff：
- **缺失**：golden 中有但契约中没有 → warning
- **多余**：契约中有但 golden 中没有 → warning
- **弃用**：`deprecated: true` 是否与官方一致

> [!IMPORTANT]
> 建议分批：先覆盖高频 20 个组件，再逐步扩展至全量。

### 1.3 结构一致性

- `type: 'enum'` 必须有非空 `enum` 数组
- `type: 'object'` 建议有 `shape`
- `type: 'array'` 建议有 `items`
- `default` 类型匹配
- `category` 值来自固定集合

---

## Layer 2：LLM 生成质量测试

### 核心思路

通过现有生成管线发送最小 prompt，每个 case 只测一个原子能力，用契约自动校验输出。

### 2.1 两类独立测试

#### A. 组件属性测试（L1 — 单组件单/多属性）

覆盖**所有 ~100 个组件**，每个组件至少 1 个 case：

```json
{
  "id": "button-primary",
  "suite": "component",
  "level": "L1",
  "prompt": "生成一个主要类型的按钮，文字为提交",
  "assertions": {
    "components": { "mustInclude": ["Button"] },
    "props": { "Button": { "type": "primary" } },
    "structure": { "maxNodeCount": 3 }
  }
}
```

```json
{
  "id": "table-basic-columns",
  "suite": "component",
  "level": "L2",
  "prompt": "生成一个表格，包含姓名、年龄、地址三列，数据源绑定 state.userList",
  "assertions": {
    "components": { "mustInclude": ["Table"] },
    "props": { "Table": { "columns": { "length": 3 } } },
    "expressions": { "mustReference": ["state.userList"] }
  }
}
```

#### B. Action 行为测试（独立于组件）

单独测试 19 种 Action 是否能被正确生成：

```json
{
  "id": "action-setState",
  "suite": "action",
  "level": "L1",
  "prompt": "生成一个按钮，点击后将 state.count 设为 0",
  "assertions": {
    "actions": {
      "mustInclude": [{ "type": "setState", "key": "count" }]
    },
    "state": { "mustDeclare": ["count"] }
  }
}
```

```json
{
  "id": "action-fetch-onSuccess",
  "suite": "action",
  "level": "L2",
  "prompt": "生成一个按钮，点击后请求 /api/users，成功后弹出成功消息",
  "assertions": {
    "actions": {
      "mustInclude": [
        { "type": "fetch" },
        { "type": "message", "level": "success" }
      ]
    }
  }
}
```

**Action 覆盖清单**：

| Action | L1 case | L2 case |
|--------|---------|---------|
| setState | 设置单个值 | 条件设置 |
| callMethod | 调用方法 | 带参数调用 |
| fetch | 基本请求 | 带 onSuccess/onError |
| navigate | 跳转 | 带参数跳转 |
| message | 弹消息 | 不同 level |
| notification | 通知 | 带 description |
| confirm | 确认框 | onOk + onCancel |
| modal | 打开弹窗 | 带 payload |
| drawer | 打开抽屉 | - |
| validate | 表单验证 | onSuccess/onError |
| resetForm | 重置表单 | 指定 fields |
| condition | 条件分支 | if-then-else |
| loop | 循环 | - |
| script | 自定义脚本 | - |
| copy | 复制 | - |
| debounce | 防抖 | - |
| throttle | 节流 | - |
| emit | 触发事件 | - |
| download | 下载 | - |

### 2.2 执行方式：走现有管线

测试通过现有 `ai-agents` 管线执行，**不另造 prompt**：

```
test case → RunRequest { prompt, context } 
    → pageBuilderOrchestrator (planPage → generateBlock → assembleSchema → repairSchema)
        → PageSchema
            → validator.ts 校验
```

这样测的就是**当前实际的提示词 + 模型**的生成质量。

### 2.3 自动校验器 (validator.ts)

**结构校验**：
- 输出合法 PageSchema / SchemaNode
- `component` 在 `builtinContractMap` 中存在
- `props` key 在对应契约中声明
- `events` key 在对应契约中声明
- Action `type` 是 19 种之一
- `enum` prop 值在枚举列表中
- `children` 符合契约声明
- 节点 [id](file:///d:/Code/lowcode/shenbi-codes/shenbi/packages/schema/types/action.ts#75-81) 唯一

**表达式校验**：
- `{{ }}` 语法合法
- 引用的 state/params/computed/ds key 已声明

**Action 校验**：
- `setState` 的 key 在 state 中声明
- `callMethod` 的 name 在 methods 中声明
- `modal`/`drawer` 的 id 在 dialogs 中存在
- `validate`/`resetForm` 的 formRef 有效

**Case 断言**：
- `mustInclude` 组件出现
- 指定 prop 值匹配
- `maxNodeCount` 限制

### 2.4 运行模式

- **CI 模式**：每个 case 跑 N 次，取通过率，低于阈值则 FAIL
- **对比模式**：修改提示词后跑同一批 case，对比通过率差异 → 量化 prompt 优化效果
- **回归模式**：模型升级后跑全量 case → 检测回退

---

## 实施路线

### Phase 1（1-2 天）：基础设施
- [ ] 搭建 `tests/contracts/` + `tests/llm-gen/` 目录
- [ ] 实现 snapshot 测试
- [ ] 实现 prop-structure 一致性测试
- [ ] 编写 `validator.ts`

### Phase 2（2-3 天）：全量用例
- [ ] 高频 20 个组件 `antd-api-golden.json`
- [ ] ~100 个组件的 L1 component case（每组件至少 1 个）
- [ ] 19 种 Action 的 L1 case
- [ ] 高频组件的 L2 component case
- [ ] 高频 Action 的 L2 case
- [ ] runner + 报告生成

### Phase 3（后续）：优化
- [ ] golden fixture 扩展至全量组件
- [ ] 接入 CI
- [ ] prompt A/B 对比模式

---

## 需要确认

> [!IMPORTANT]

1. **golden fixture 来源**：从 ant.design 手动整理还是写脚本半自动抓取？
2. **测试文件位置**：放在 `packages/schema/tests/` 还是 `apps/ai-api/src/test/` 还是新建独立包？
3. **通过率阈值**：L1 建议 90%+，L2 建议 70%+，合理吗？
