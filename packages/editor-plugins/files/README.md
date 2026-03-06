# `@shenbi/editor-plugin-files`

`@shenbi/editor-plugin-files` 负责文件工作流插件。当前主入口是 `createFilesPlugin(...)`，通过 sidebar tab 接入宿主。

## 这个包负责什么

- `createFilesPlugin(...)`
- `createFilesSidebarTab(...)`
- `useFileWorkspace(...)`
- `FilePanel`

## 当前稳定依赖契约

Files 插件不直接操作宿主私有状态，统一通过命令执行器工作。当前依赖的命令如下：

- `file.listSchemas`
- `file.openSchema`
- `file.saveSchema`
- `file.saveAs`
- `editor.undo`
- `editor.redo`

也就是说，Files 关心的是文件工作流，不关心宿主到底是 shell 模式还是 scenarios 模式。

## 变更规则

1. 新文件工作流优先复用现有命令 ID。
2. 若必须新增文件命令，先改 `editor-core` 的命令基线，再更新本 README。
3. 不要在插件内部直接依赖某个 app 的本地存储实现。

## 建议使用方式

- 宿主侧：
  - 用 `useFileWorkspace(...)` 做状态桥接
  - 把 `filesSidebarTabOptions` 传给 `createFilesPlugin(...)`
- 插件侧：
  - 通过 manifest 贡献 sidebar tab
  - 不自行拼装宿主协议

## 不负责什么

- 不负责 `PluginContext` 协议定义
- 不负责宿主命令注册表
- 不负责 AI / Setter 能力

## 参考

- 协议来源：[`packages/editor-plugins/api/README.md`](../api/README.md)
- 命令来源：[`packages/editor-core/README.md`](../../editor-core/README.md)
