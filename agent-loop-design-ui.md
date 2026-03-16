# AI 聊天界面改动分析

## 当前 UI 组件结构

```
AIPanel.tsx (504 行)
├── Header: 标题 + 清除按钮
├── Model Selectors: Planner / Block 模型选择
├── Thinking Toggle: 思考模式开关
├── Concurrency Slider: 并发度滑块
├── Message Area:
│   ├── ChatMessageList.tsx (153 行)
│   │   ├── 用户消息 (头像 + 文本 + 附件)
│   │   └── 助手消息 (头像 + 文本)
│   ├── Running Card (内联在 AIPanel 中)
│   │   ├── 进度条 + 进度文本 + 计时
│   │   ├── Block 列表 (创建页面时)
│   │   └── Modify Op 列表 (修改页面时)
│   └── RunResultCard.tsx (164 行) — 完成后展示
│       ├── 操作列表 + Metrics
│       └── Debug 文件路径
├── Status Bar: 选中节点 + Bridge 状态
└── ChatInput.tsx (343 行)
    ├── Preset 下拉 + History 下拉 + 附件按钮
    ├── 附件预览条
    └── Textarea + 发送/取消按钮
```

---

## 需要改动的 7 个区域

### ① Running Card → ReAct 步骤可视化 【主要改动】

**现状**：Running Card 展示 Block 列表或 Modify Op 列表，面向单页面。

**改动**：需要展示 ReAct 循环的实时步骤。展示主轴应以 `Action` 为准，说明文字（如 `Status` / `Reasoning Summary`）为可选字段。

```
┌─ 🔄 Agent Loop 运行中 ─────────────────── 45s ─┐
│                                                   │
│ 🔧 listWorkspaceFiles()                      50ms │
│ 💭 正在检查现有页面，避免重复创建            3.2s │
│ 🔧 readPageSchema("page-1")                 120ms │
│ 💭 首页不含考勤功能，先给出项目规划          2.8s │
│ 📋 proposeProjectPlan(...) → 等待确认              │
│                                                   │
│ [展开/折叠 详细内容]                              │
└───────────────────────────────────────────────────┘
```

- 说明步骤：💭 + `Status` / `Reasoning Summary` + 耗时（可选）
- Action 步骤：🔧 + 工具名 + 耗时（必显）
- 等待确认时：暂停动画
- 生成页面时：嵌套显示当前页面的 block 进度

> [!IMPORTANT]
> 这个组件建议抽取为独立的 `ReActStepList.tsx`，不要继续内联在 AIPanel。

---

### ② 新增 ProjectPlanCard 【新组件】

当 LLM 调用 `proposeProjectPlan` 时，展示确认卡片：

```
┌─ 📋 项目规划：考勤管理系统 ──────────────────────┐
│                                                     │
│  ✅ 新建  考勤打卡页    包含上下班打卡、位置验证    │
│  ✅ 新建  请假申请页    请假类型选择、日期范围...    │
│  ✅ 新建  审批管理页    审批列表、审批操作            │
│  ✅ 新建  统计报表页    出勤率、迟到统计...           │
│  ⏭️ 跳过  首页         已存在，无需修改              │
│                                                     │
│  [ ✅ 确认生成 ]  [ ✏️ 修改 ]  [ ❌ 取消 ]          │
└─────────────────────────────────────────────────────┘
```

- 每行显示：操作类型（新建/修改/跳过）+ 名称 + 描述
- 跳过的页面灰色显示 + 原因
- 确认/修改/取消按钮

---

### ③ 新增 ProjectProgressCard 【新组件】

确认后，展示每个页面的生成进度：

```
┌─ 🚀 正在生成 (2/4) ─────────── 总计 1m 32s ──┐
│                                                 │
│  ✅ 考勤打卡页     完成      18.2s              │
│  🔄 请假申请页     生成中... 12.5s              │
│     ├── Header 区块      ✅ 3.2s               │
│     ├── Form 表单        🔄 generating...       │
│     └── Footer 操作栏    ⏳ 等待中              │
│  ⏳ 审批管理页     等待中                       │
│  ⏳ 统计报表页     等待中                       │
│                                                 │
│  [━━━━━━━━━━━━░░░░░░░░░░░] 50%                 │
└─────────────────────────────────────────────────┘
```

- 总进度条 + 计时
- 每个页面：状态图标 + 名称 + 耗时
- 当前页面展开显示 block 级别进度（复用现有 OpRow）
- 失败页面红色标记

---

### ④ ChatInput 【无改动或极小改动】

当前 [ChatInput](file:///d:/Code/lowcode/shenbi-codes/shenbi/packages/editor-plugins/ai-chat/src/ui/ChatInput.tsx#153-343) 已经支持：
- ✅ 文本输入
- ✅ 附件上传（支持 doc/pdf/图片）
- ✅ Preset 预设
- ✅ 历史记录
- ✅ 运行中显示取消按钮

**可选增强**：
- 在 preset 中增加"项目级"预设（如"创建一个XX系统"）
- 在 `awaiting_confirmation` 阶段，输入区域可以替换为确认按钮组

---

### ⑤ ChatMessageList 【小改动】

**现状**：只显示 user/assistant 纯文本消息 + 附件。

**改动**：
- 新增 `thought` 或 `status` 类型消息气泡，用于显示 ReAct 的可选说明文字
- 样式：浅紫色/灰色背景，斜体文字，💭 图标
- 可折叠（长说明默认折叠）

---

### ⑥ RunResultCard 【扩展】

**现状**：显示单次运行结果（block 列表 + modify op 列表 + metrics + debug file）。

**改动**：
- 支持展示 Agent Loop 结果（多个页面的汇总）
- 新增 `agentLoopTraceFile` 字段展示
- 可切换查看每个页面的详细结果
- 总统计：总耗时、总 token、页面完成数

---

### ⑦ AIPanel 顶层 【中等改动】

**hook 替换**：
```diff
- const { isRunning, progressText, ... } = useAgentRun(bridge);
+ const { isRunning, phase, progressText, ... } = useAgentLoop(bridge, fileCommands);
```

**根据 phase 渲染不同内容**：

| Phase | 渲染内容 |
|-------|---------|
| `idle` | 欢迎消息 + ChatInput |
| `thinking` | ReActStepList (实时 Action + 可选说明文字) |
| `awaiting_confirmation` | ProjectPlanCard (规划确认) |
| `executing` | ProjectProgressCard (逐页生成) |
| `done` | RunResultCard (完成汇总) |
| [error](file:///d:/Code/lowcode/shenbi-codes/shenbi/packages/ai-agents/src/types.ts#98-99) | 错误消息 |

**可能移除或隐藏的**：
- `Concurrency Slider`：在 Agent Loop 中由 LLM 自动管理
- 或保留作为高级选项

---

## 不需要改的部分

| 组件 | 原因 |
|------|------|
| Header 标题栏 | 通用，不需要改 |
| Model Selector | 仍然需要选择模型 |
| Thinking Toggle | 仍然有效 |
| 附件系统 | 已支持 doc/pdf |

---

## 建议的新 UI 文件清单

| 文件 | 功能 |
|------|------|
| `ReActStepList.tsx` | ReAct 步骤实时展示（以 Action 为主，说明文字可选） |
| `ProjectPlanCard.tsx` | 项目规划确认卡片 |
| `ProjectProgressCard.tsx` | 多页面生成进度卡片 |
| `LoopTraceViewer.tsx` | 完成后的 Agent Loop 调试日志查看器 |
