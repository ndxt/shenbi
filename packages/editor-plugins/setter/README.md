# `@shenbi/editor-plugin-setter`

`@shenbi/editor-plugin-setter` 负责属性面板相关的 inspector tabs 和 setter UI。当前主入口是 `createSetterPlugin(...)`。

## 这个包负责什么

- `createSetterPlugin(...)`
- `createBuiltinInspectorTabs()`
- `SetterPanel`
- `ActionPanel`

## 当前稳定依赖契约

Setter 插件对 schema 的写操作应统一通过 `PluginContext.document.patchSelectedNode.*` 完成：

- `props`
- `columns`
- `style`
- `events`
- `logic`

对选中节点的读取应统一通过：

- `selection.getSelectedNode()`
- `selection.getSelectedNodeId()`

如果是 inspector tab 适配层，需要兼容 `PluginContext` 的宿主兑现差异，统一走 `editor-plugin-api` 的 grouped accessor，尤其是：

- `getPluginDocumentAccess(...)`
- `getPluginSelectionAccess(...)`

不要在 setter 包里重新引入或新增 `getPluginSchema()`、`getPluginSelectedNodeId()` 这类字段级 helper 依赖。

## 变更规则

1. Setter 增强优先新增 inspector tab，不要在宿主层加专属 props。
2. 不允许直接依赖旧 alias：
   - `patchNodeProps`
   - `patchNodeEvents`
   - `getSelectedNode`
3. 如果需要新的宿主能力，先证明不能仅靠现有 `document / selection / commands / notifications` 或现有 grouped accessor 完成。

## 不负责什么

- 不负责宿主侧的树结构与选择同步
- 不负责 `PluginContext` 协议定义
- 不负责文件持久化

## 参考

- 协议来源：[`packages/editor-plugins/api/README.md`](../api/README.md)
- 宿主桥接：[`packages/editor-ui/README.md`](../../editor-ui/README.md)
