# `@shenbi/editor-plugin-api`

`@shenbi/editor-plugin-api` 是插件平台唯一的协议来源。任何插件接入、宿主接线、贡献点定义，都应以这个包为准。

## 这个包负责什么

- `PluginContext`
- `PluginContributes`
- `EditorPluginManifest`
- contribution 类型：
  - `activityBarItems`
  - `sidebarTabs`
  - `inspectorTabs`
  - `auxiliaryPanels`
  - `menus`
  - `contextMenus`
  - `commands`
  - `shortcuts`

## 当前稳定服务面

`PluginContext` 当前稳定且允许新插件直接使用的只有四类服务：

- `document`
- `selection`
- `commands`
- `notifications`

旧 alias 仍保留兼容，但只允许在 `context.ts` 中兜底，不允许新插件继续直接使用：

- `getSchema`
- `replaceSchema`
- `getSelectedNode`
- `patchNode*`
- `executeCommand`
- `notify`

## 生命周期冻结

- `register` 是宿主内部步骤，不是插件钩子
- 插件作者只需要声明 `manifest`
- 插件可选实现 `activate(context)`
- `activate` 可返回 cleanup
- `deactivate / dispose` 由宿主统一消费 cleanup

## `when` / `enabledWhen` 规则

当前运行时只支持最小语法：

- `editorFocused`
- `!inputFocused`
- `editorFocused && !inputFocused`

当前不支持：

- `||`
- 括号
- 更复杂的 VS Code when clause 语法

## 快捷键规则

- `PluginShortcutContribution` 使用独立的 `priority` 解决冲突
- `order` 只用于展示排序，不承担冲突优先级语义
- 输入框聚焦时，快捷键默认不触发；只有显式声明相关条件时才放行

## 变更规则

1. 插件协议变更优先做增量扩展。
2. 改 `PluginContext` 或 `EditorPluginManifest` 前，必须同步检查：
   - `packages/editor-ui/README.md`
   - 相关插件包 README
   - `docs/README.md`
3. 新服务面没有经过平台准入评审前，不进入 `PluginContext`。

## 参考

- 宿主兑现层：[`packages/editor-ui/README.md`](../../editor-ui/README.md)
- 冻结背景：[`docs/active/platform-plugin-lifecycle-and-service-freeze.md`](../../../docs/active/platform-plugin-lifecycle-and-service-freeze.md)
