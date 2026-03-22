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

`workspace / persistence / filesystem` 仍然存在于 `PluginContext`，但它们属于宿主桥接能力，不是默认鼓励所有插件直接扩张依赖的通用服务面。插件侧如果直接读取 `pluginContext.filesystem / persistence / workspace`，仓库根 `pnpm lint:plugin-context-boundaries` 会直接拦截。

## Accessor 风格

从包根导出的 `PluginContext` helper 现在只保留聚合 accessor，不再继续暴露零散字段级 helper。

当前允许从 `@shenbi/editor-plugin-api` 根入口直接使用的 accessor：

- `getPluginDocumentAccess(context)`
- `getPluginSelectionAccess(context)`
- `getPluginCommandAccess(context)`
- `getPluginFeedbackAccess(context)`
- `getPluginWorkspaceAccess(context)`
- `getPluginStorageAccess(context)`

其中 `document / selection` accessor 不只负责同步读写，也承载订阅能力：

- `getPluginDocumentAccess(context).subscribe(...)`
- `getPluginSelectionAccess(context).subscribe(...)`

使用原则：

1. 插件 bridge / adapter 层优先消费这些 grouped accessor，不要直读 `context.document?.subscribe`、`context.selection?.subscribe` 之类的细节服务。
2. 新 helper 若只是 `getPluginXxxField()` 这种字段级包装，不进入包根导出面。
3. 如果某类访问还不值得形成一组能力，就优先直接使用 `PluginContext` 的稳定服务面，而不是继续堆新的 helper 名称。

## 导出面原则

`@shenbi/editor-plugin-api` 根入口只应暴露三类东西：

- 稳定协议类型：`PluginContext`、manifest、contribution contexts
- 少量真正跨插件复用的宿主 accessor
- 插件定义入口

以下内容默认不应再从包根直接导出：

- 仅用于类型拆分的中间 context 子类型
- 单字段/单方法级 helper
- 只服务单个插件包实现细节的兼容函数

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

这条限制不是纯文档约定。源码里的 `when / enabledWhen` 字符串字面量会被 `pnpm lint:plugin-context-boundaries` 校验，CI 通过根 `pnpm type-check` 一起执行。

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
4. 新 helper 若不能归入现有 accessor 分组，默认不加入包根导出面。
5. 已删除的旧 alias 与字段级 helper 不得重新引入，仓库根 `pnpm lint:plugin-context-boundaries` 会直接拦截。
6. `pluginContext.filesystem / persistence / workspace` 的直读，以及不受支持的 `when / enabledWhen` 字面量语法，也会被同一条边界检查直接拦截。

## 参考

- 宿主兑现层：[`packages/editor-ui/README.md`](../../editor-ui/README.md)
- 冻结背景：[`docs/active/platform-plugin-lifecycle-and-service-freeze.md`](../../../docs/active/platform-plugin-lifecycle-and-service-freeze.md)
