# 剩余 UI i18n 并行开发计划文档

## Summary
目标是继续沿用当前已经落地的 i18n 思路，把“还未接入 i18n 的生产界面组件”拆到一个并行分支里完成，不改 `editor-core`、不把插件文案重新集中回 `packages/i18n`。  
本计划只覆盖真实产品界面，不包含 demo/schema/mock 的样例文本全量国际化。

建议分支策略：
- 基线：`main` 上当前已合入的 i18n 与 workspace preference 改动
- 新分支：`codex/i18n-ui-followups`
- 开发前先保证工作区干净，不把当前无关改动带入这个分支

## How To Do
### 1. 先整理基线
- 从干净的 `main` 切新分支，不直接在当前脏工作区上开发。
- 排除当前无关文件：
  - [apps/preview/vite.config.ts](/C:/Users/zhang/Code/LowCode/shenbi-codes/shenbi/apps/preview/vite.config.ts)
  - [packages/engine/src/renderer/node-renderer.tsx](/C:/Users/zhang/Code/LowCode/shenbi-codes/shenbi/packages/engine/src/renderer/node-renderer.tsx)
- 目标是让这个分支只承载“剩余 UI i18n”改动。

### 2. 继续沿用现有 i18n 规则
- 宿主 `editor-ui` 文案继续放 `editorUi` namespace。
- preview 壳层文案继续放 `preview` namespace。
- 插件文案归插件自己所有：
  - `setter` 新增自己的 plugin namespace
  - `ai-chat` 新增自己的 plugin namespace
- `packages/i18n` 只继续做：
  - i18n instance
  - hooks
  - 宿主 locale 数据
  - 插件注册机制
- 不再把插件词条中心化堆进 `packages/i18n/locales/plugin*.json`。

### 3. 开发顺序
- 第一阶段：补宿主通用 UI
- 第二阶段：补 Setter 插件
- 第三阶段：补 AI Chat 插件
- 第四阶段：补测试与文案回归

## What To Change
### A. 宿主 `editor-ui`
优先处理这些真正还在裸写文案的文件：

- [packages/editor-ui/src/ui/EditorTabs.tsx](/C:/Users/zhang/Code/LowCode/shenbi-codes/shenbi/packages/editor-ui/src/ui/EditorTabs.tsx)
  - 接入 `useTranslation('editorUi')`
  - 替换：
    - `未保存`
    - `未保存 (Ctrl+S 保存)`
    - `关闭`
    - `关闭其他`
    - `关闭已保存的`
    - `关闭所有`
    - `Untitled`
  - 要注意 `title`、右键菜单和 fallback label 都要一起处理

- [packages/editor-ui/src/ui/CommandPalette.tsx](/C:/Users/zhang/Code/LowCode/shenbi-codes/shenbi/packages/editor-ui/src/ui/CommandPalette.tsx)
  - 接入 `useTranslation('editorUi')`
  - 替换：
    - `Command Palette`
    - `Command Palette Search`
    - `Type a command`
    - `Command Palette Results`
    - `No commands found.`
    - `Recent`
    - `Other`
  - `aria-label`、placeholder、空态、分组标题都要一起国际化

- [packages/editor-ui/src/commands/host-command-registry.ts](/C:/Users/zhang/Code/LowCode/shenbi-codes/shenbi/packages/editor-ui/src/commands/host-command-registry.ts)
  - 不建议在纯工具函数里直接塞 hook
  - 推荐做法：
    - 把 `createHostCommandRegistry` 改为接收一个翻译能力参数，例如 `t`
    - 或在 `AppShell` 中先生成本地化 title/category/description，再传入 registry builder
  - 需要国际化：
    - title
    - category
    - description
    - aliases
    - keywords
  - 原因：命令面板搜索命中依赖这些字段，不能只翻标题

- [packages/editor-ui/src/panels/PagePanel.tsx](/C:/Users/zhang/Code/LowCode/shenbi-codes/shenbi/packages/editor-ui/src/panels/PagePanel.tsx)
  - 接入 `useTranslation('editorUi')`
  - 替换整块静态标题和按钮文案
  - 这块如果目前主要是 mock/static panel，也仍应统一文案来源

- [packages/editor-ui/src/panels/SchemaTree.tsx](/C:/Users/zhang/Code/LowCode/shenbi-codes/shenbi/packages/editor-ui/src/panels/SchemaTree.tsx)
  - 接入 `useTranslation('editorUi')`
  - 替换：
    - mock tree 节点名
    - `已隐藏`
  - 如果 mock tree 只是演示数据，至少先把 tooltip 和 visible UI 文案国际化
  - mock node name 可先放到 `editorUi` locale，后续再考虑是否抽为 demo data

### B. Setter 插件
当前主要文件：

- [packages/editor-plugins/setter/src/SetterPanel.tsx](/C:/Users/zhang/Code/LowCode/shenbi-codes/shenbi/packages/editor-plugins/setter/src/SetterPanel.tsx)
- [packages/editor-plugins/setter/src/ActionPanel.tsx](/C:/Users/zhang/Code/LowCode/shenbi-codes/shenbi/packages/editor-plugins/setter/src/ActionPanel.tsx)

建议做法：
- 新增插件侧 i18n 注册文件，例如：
  - `packages/editor-plugins/setter/src/i18n.ts`
- 在插件入口完成 namespace 注册
- namespace 建议命名：`pluginSetter`

需要覆盖：
- 可见 tab 文案
- 表单 label
- placeholder
- JSON 解析错误提示
- 必填/校验类错误
- 操作按钮
- 空态/说明文案

特别注意：
- `SetterPanel.tsx` 里有大量错误字符串，例如“属性值必须是数组 JSON”这类，不能只翻可见标题，错误路径也要一起接 i18n。
- 如果某些字符串用于内部调试、不会直接展示给用户，可以暂缓；但目前看大部分是直接会暴露到 UI 的。

### C. AI Chat 插件
当前主要文件：

- [packages/editor-plugins/ai-chat/src/ui/AIPanel.tsx](/C:/Users/zhang/Code/LowCode/shenbi-codes/shenbi/packages/editor-plugins/ai-chat/src/ui/AIPanel.tsx)
- [packages/editor-plugins/ai-chat/src/ui/ChatInput.tsx](/C:/Users/zhang/Code/LowCode/shenbi-codes/shenbi/packages/editor-plugins/ai-chat/src/ui/ChatMessageList.tsx)
- [packages/editor-plugins/ai-chat/src/ui/RunResultCard.tsx](/C:/Users/zhang/Code/LowCode/shenbi-codes/shenbi/packages/editor-plugins/ai-chat/src/ui/RunResultCard.tsx)

建议做法：
- 新增插件侧 i18n 注册文件，例如：
  - `packages/editor-plugins/ai-chat/src/i18n.ts`
- 在 AI Chat 插件入口注册 namespace
- namespace 建议命名：`pluginAiChat`

需要覆盖：
- 面板标题
- `清空`
- prompt preset 名称
- prompt preset 内容
- 历史输入
- 输入框 placeholder
- 运行中/完成/错误文案
- `未选中`
- 模型错误提示
- 调试文件标签
- 空态与说明文字

特别注意：
- `PROMPT_PRESETS` 目前是中文内容本身，不只是 label。英文模式下如果仍发送中文 prompt，会很割裂。
- 推荐把 `label` 和 `value` 都国际化，让中英文模式下给模型的默认 prompt 也切语言。
- `Trace File` / `Debug File` 这种当前是英文常量，也应统一走 i18n，避免中英文混杂。

## Locale / Namespace Work
### 宿主 locale
扩展：
- [packages/i18n/locales/zh-CN/editorUi.json](/C:/Users/zhang/Code/LowCode/shenbi-codes/shenbi/packages/i18n/locales/zh-CN/editorUi.json)
- [packages/i18n/locales/en-US/editorUi.json](/C:/Users/zhang/Code/LowCode/shenbi-codes/shenbi/packages/i18n/locales/en-US/editorUi.json)

建议新增分组：
- `editorTabs.*`
- `commandPalette.*`
- `hostCommands.*`
- `pagePanel.*`
- `schemaTree.*`

### Setter locale
新增插件自有 locale，建议放插件内，避免中心化 ownership：
- `packages/editor-plugins/setter/src/i18n.ts`
- 如果项目当前仍要求 locale JSON 集中在 `packages/i18n/locales`，那也要保持“词条归插件维护”的约束并在计划里注明；但推荐优先插件内注册资源对象。

### AI Chat locale
同理新增：
- `packages/editor-plugins/ai-chat/src/i18n.ts`

建议分组：
- `panel.*`
- `history.*`
- `preset.*`
- `status.*`
- `errors.*`
- `debug.*`

## How To Verify
### 定向检查
- `pnpm --filter @shenbi/editor-ui type-check`
- `pnpm --filter @shenbi/editor-plugin-setter type-check`
- `pnpm --filter @shenbi/editor-plugin-ai-chat type-check`
- `pnpm --filter @shenbi/preview type-check`

### UI 行为验证
- 英文模式下检查：
  - 右键 tab 菜单
  - Command Palette 标题、placeholder、空态
  - Host commands 分类与描述
  - Setter 四个 tab 下的提示与报错
  - AI Chat 面板标题、清空、常用覆盖场景、历史输入、错误提示
- 中文模式下检查：
  - 回归不丢中文
  - 已有 Files/preview/i18n 行为不回退

### 测试补充
建议新增或更新：
- `editor-ui`
  - `AppShell.test.tsx`
  - `CommandPalette` 相关测试
  - `EditorTabs` 相关测试
- `setter`
  - `SetterPanel.test.tsx`
- `ai-chat`
  - `AIPanel.test.tsx`
  - 必要时 `AIPanel.integration.test.tsx`
- 原则：
  - 测试断言不要再只写死中文
  - 对真正依赖 locale 的断言，明确先切换语言，再断言结果

## Explicit File List
建议第一波开发文件清单：

- [packages/editor-ui/src/ui/EditorTabs.tsx](/C:/Users/zhang/Code/LowCode/shenbi-codes/shenbi/packages/editor-ui/src/ui/EditorTabs.tsx)
- [packages/editor-ui/src/ui/CommandPalette.tsx](/C:/Users/zhang/Code/LowCode/shenbi-codes/shenbi/packages/editor-ui/src/ui/CommandPalette.tsx)
- [packages/editor-ui/src/commands/host-command-registry.ts](/C:/Users/zhang/Code/LowCode/shenbi-codes/shenbi/packages/editor-ui/src/commands/host-command-registry.ts)
- [packages/editor-ui/src/panels/PagePanel.tsx](/C:/Users/zhang/Code/LowCode/shenbi-codes/shenbi/packages/editor-ui/src/panels/PagePanel.tsx)
- [packages/editor-ui/src/panels/SchemaTree.tsx](/C:/Users/zhang/Code/LowCode/shenbi-codes/shenbi/packages/editor-ui/src/panels/SchemaTree.tsx)
- [packages/editor-plugins/setter/src/SetterPanel.tsx](/C:/Users/zhang/Code/LowCode/shenbi-codes/shenbi/packages/editor-plugins/setter/src/SetterPanel.tsx)
- [packages/editor-plugins/setter/src/ActionPanel.tsx](/C:/Users/zhang/Code/LowCode/shenbi-codes/shenbi/packages/editor-plugins/setter/src/ActionPanel.tsx)
- [packages/editor-plugins/ai-chat/src/ui/AIPanel.tsx](/C:/Users/zhang/Code/LowCode/shenbi-codes/shenbi/packages/editor-plugins/ai-chat/src/ui/AIPanel.tsx)
- [packages/editor-plugins/ai-chat/src/ui/ChatInput.tsx](/C:/Users/zhang/Code/LowCode/shenbi-codes/shenbi/packages/editor-plugins/ai-chat/src/ui/ChatInput.tsx)
- [packages/editor-plugins/ai-chat/src/ui/ChatMessageList.tsx](/C:/Users/zhang/Code/LowCode/shenbi-codes/shenbi/packages/editor-plugins/ai-chat/src/ui/ChatMessageList.tsx)
- [packages/editor-plugins/ai-chat/src/ui/RunResultCard.tsx](/C:/Users/zhang/Code/LowCode/shenbi-codes/shenbi/packages/editor-plugins/ai-chat/src/ui/RunResultCard.tsx)
- [packages/i18n/locales/zh-CN/editorUi.json](/C:/Users/zhang/Code/LowCode/shenbi-codes/shenbi/packages/i18n/locales/zh-CN/editorUi.json)
- [packages/i18n/locales/en-US/editorUi.json](/C:/Users/zhang/Code/LowCode/shenbi-codes/shenbi/packages/i18n/locales/en-US/editorUi.json)
- `setter` / `ai-chat` 各自新增的 `i18n.ts` 与对应测试文件

## Assumptions
- 当前这波不处理：
  - `apps/preview/src/schemas/*`
  - `apps/preview/src/demo-*`
  - `apps/preview/src/mock/*`
  - `editor-core` / `engine` 数据与运行时层
- 当前这波只做“生产 UI 先行”。
- 开发时继续保持“宿主文案归宿主，插件文案归插件”的 ownership，不回退到中心化插件词条方案。
