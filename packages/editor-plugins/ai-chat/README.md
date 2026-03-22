# `@shenbi/editor-plugin-ai-chat`

`@shenbi/editor-plugin-ai-chat` 负责 AI 辅助面板和 editor AI bridge。当前主入口是 `createAIChatPlugin(...)`。

## 这个包负责什么

- `createAIChatPlugin(...)`
- `createEditorAIBridgeFromPluginContext(...)`
- `useEditorAIBridge(...)`
- `AIPanel`
- demo schema 生成辅助

## 当前稳定依赖契约

AI 插件读写编辑器状态时，优先走 `PluginContext` 的新服务面：

- 读取 schema：`document.getSchema()`
- 替换 schema：`document.replaceSchema(...)`
- 读取选择：`selection.getSelectedNode()` / `getSelectedNodeId()`
- 执行宿主命令：`commands.execute(...)`

如果是 bridge / adapter 层，需要从 `PluginContext` 做兼容解析，统一走 `editor-plugin-api` 的 grouped accessor：

- `getPluginDocumentAccess(...)`
- `getPluginSelectionAccess(...)`
- `getPluginCommandAccess(...)`
- `getPluginStorageAccess(...)`

当前不应在插件实现层直接判断旧 alias 是否存在，也不要再新增 `getPluginSchema()` 这类字段级 helper 依赖。

## 变更规则

1. AI 侧的 schema 替换优先调用 `document.replaceSchema(...)`。
2. 若需要宿主命令，统一走 `commands.execute(...)`，不要假设宿主一定实现某个专属面板 props。
3. 若 bridge 需要兼容宿主差异，优先复用 grouped accessor，不要在本包再包一层零散 `PluginContext` helper。
4. Bridge 是插件内适配层，不是新的宿主协议来源。

## 不负责什么

- 不负责宿主生命周期
- 不负责菜单 / 快捷键基础设施
- 不负责文件工作流

## 参考

- 协议来源：[`packages/editor-plugins/api/README.md`](../api/README.md)
- 宿主层：[`packages/editor-ui/README.md`](../../editor-ui/README.md)
