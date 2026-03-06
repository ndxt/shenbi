# `@shenbi/editor-ui`

`@shenbi/editor-ui` 是编辑器宿主层。它负责壳层 UI、扩展点容器、宿主桥接和可复用的 host hooks，不应该再承载 Files / Setter / AI 的主业务实现。

## 这个包负责什么

- 宿主壳层与扩展点容器：
  - `AppShell`
  - `ActivityBar`
  - `Sidebar`
  - `Inspector`
  - `WorkbenchToolbar`
  - `CommandPalette`
- 宿主 hooks：
  - `useEditorSession`
  - `useScenarioSession`
  - `useEditorHostBridge`
  - `useSelectionSync`
  - `useNodePatchDispatch`
  - `usePluginContext`
  - `useShellModeUrl`

## 当前稳定宿主边界

`editor-ui` 当前只承接三类职责：

1. 壳层 UI 与扩展点容器
2. 宿主状态桥接
3. 对 `editor-plugin-api` 的运行时兑现

以下内容不应再新增到这里作为主实现：

- Files 业务逻辑
- Setter 业务逻辑
- AI Chat 业务逻辑

这些应继续落到 `packages/editor-plugins/*`。

## 与插件平台的关系

`editor-ui` 负责兑现插件平台的运行时模型：

- 命令注册表
- 快捷键
- 菜单 / 上下文菜单
- 命令面板
- 插件激活与清理

但插件协议本身不在这里定义，唯一来源是 `@shenbi/editor-plugin-api`。

## 当前冻结规则

1. `PluginContext` 的稳定服务面只有：
   - `document`
   - `selection`
   - `commands`
   - `notifications`
2. 新业务能力优先复用命令总线和这四类服务面。
3. 新的插件扩展点或宿主能力，只有在足够通用时才进入这里。

## 何时放进这个包

- 是宿主通用能力：放这里
- 是插件协议：放 `editor-plugin-api`
- 是某个具体插件：放 `editor-plugins/*`
- 是纯编辑器状态 / 命令：放 `editor-core`

## 参考

- 插件协议冻结：[`packages/editor-plugins/api/README.md`](../editor-plugins/api/README.md)
- 跨包冻结结论：[`docs/active/platform-plugin-lifecycle-and-service-freeze.md`](../../docs/active/platform-plugin-lifecycle-and-service-freeze.md)
