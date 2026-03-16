# `@shenbi/editor-core`

`@shenbi/editor-core` 是编辑器域模型层。它负责编辑器状态、历史、命令总线、文件持久化和纯 schema patch 工具，不依赖 React 宿主。

## 这个包负责什么

- `EditorState` / `EditorStateSnapshot`
- `History`
- `EventBus`
- `CommandManager`
- `createEditor(...)`
- `MemoryFileStorageAdapter`
- schema tree / patch 工具：
  - `buildEditorTree`
  - `getSchemaNodeByTreeId`
  - `getTreeIdBySchemaNodeId`
  - `patchSchemaNodeProps`
  - `patchSchemaNodeEvents`
  - `patchSchemaNodeStyle`
  - `patchSchemaNodeLogic`
  - `patchSchemaNodeColumns`

## 当前稳定命令 ID

以下内置命令已形成稳定基线：

- `schema.replace`
- `node.patchProps`
- `node.patchEvents`
- `node.patchStyle`
- `node.patchLogic`
- `node.patchColumns`
- `editor.undo`
- `editor.redo`
- `file.listSchemas`
- `file.openSchema`
- `file.saveSchema`
- `file.saveAs`

后续若新增命令，应做增量新增；不要轻易改命令 ID、参数结构或语义。

## 边界

这个包不负责：

- React 宿主 UI
- 插件生命周期
- `PluginContext`
- 快捷键、菜单、命令面板

这些都属于 `@shenbi/editor-ui` 或 `@shenbi/editor-plugin-api`。

## 变更规则

1. 如果某个能力可以不依赖 React 完成，优先放在这里。
2. 任何 schema patch 规则都优先在这里落纯函数，不要在 `apps/preview` 或 `editor-ui` 重复实现。
3. 内置命令参数变更必须同步检查：
   - `packages/editor-core/src/create-editor.ts`
   - `packages/editor-core/README.md`
   - `packages/editor-ui/README.md`
   - `packages/editor-plugins/files/README.md`

## 典型使用方式

- 宿主创建编辑器实例：`createEditor(...)`
- 宿主通过 `commands.execute(...)` 触发编辑操作
- 宿主通过 `state.getSnapshot()` 读取 schema / dirty / undo / redo 状态

## 参考

- 宿主层说明：[`packages/editor-ui/README.md`](../editor-ui/README.md)
