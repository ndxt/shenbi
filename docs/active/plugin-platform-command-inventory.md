# 插件平台命令清单与归类

> 对应 Phase 3.1
> 目的：把当前已存在的核心命令按“继续走命令总线”或“未来可提升为服务面能力”归类，避免后续重复设计。

---

## 1. 归类规则

1. 读状态、订阅状态、同步 patch 倾向进入服务面。
2. 触发动作、流程驱动、可由快捷键/菜单/命令面板统一调用的能力，继续走命令总线。
3. 命令总线优先承载“动作”，服务面优先承载“状态”。

---

## 2. 当前内置命令

来源：`packages/editor-core/src/create-editor.ts`

| 命令 ID | 当前职责 | 归类 | 说明 |
|--------|----------|------|------|
| `schema.replace` | 替换整页 schema | 继续保留命令，同时由 `document.replaceSchema` 提供直接服务 | 已有直接服务入口，命令仍保留给 AI、命令面板、快捷键等动作型触发 |
| `node.patchProps` | patch 节点 props | 继续保留命令，同时由 `document.patchSelectedNode.props` 提供直接服务 | 高频 patch 已有服务面，命令继续承担统一触发入口 |
| `node.patchEvents` | patch 节点 events | 继续保留命令，同时由 `document.patchSelectedNode.events` 提供直接服务 | 同上 |
| `node.patchStyle` | patch 节点 style | 继续保留命令，同时由 `document.patchSelectedNode.style` 提供直接服务 | 同上 |
| `node.patchLogic` | patch 节点 logic | 继续保留命令，同时由 `document.patchSelectedNode.logic` 提供直接服务 | 同上 |
| `node.patchColumns` | patch 节点 columns | 继续保留命令，同时由 `document.patchSelectedNode.columns` 提供直接服务 | 同上 |
| `editor.undo` | 撤销 | 保留命令 | 典型动作型能力，适合快捷键与命令面板触发 |
| `editor.redo` | 重做 | 保留命令 | 同上 |
| `file.listSchemas` | 列出文件 | 暂时保留命令，后续部分能力可沉到 `workspace` | 初版继续走命令；若后续多个插件需要共享文件列表，可评估只读 workspace 查询 |
| `file.openSchema` | 打开文件 | 保留命令 | 典型流程型动作，不建议进入服务面 |
| `file.saveSchema` | 保存文件 | 保留命令 | 典型动作型能力，适合快捷键与命令面板触发 |
| `file.saveAs` | 另存为 | 保留命令 | 同上 |

---

## 3. 当前结论

### 3.1 应继续走命令总线

1. `editor.undo`
2. `editor.redo`
3. `file.openSchema`
4. `file.saveSchema`
5. `file.saveAs`
6. 后续 `commandPalette.open`
7. 后续 `editor.copy / paste / cut / deleteNode`

原因：

1. 都是动作型调用。
2. 适合作为快捷键、菜单、命令面板的统一触发目标。

### 3.2 已同时具备服务面和命令语义

1. `schema.replace`
2. `node.patchProps`
3. `node.patchEvents`
4. `node.patchStyle`
5. `node.patchLogic`
6. `node.patchColumns`

原因：

1. 插件内高频调用时更适合直接服务。
2. 从命令面板、快捷键、AI 或宿主兜底触发时仍需要命令入口。

结论：

1. 这类能力保持“双入口”，但两者都应映射到同一底层状态变更语义。
2. 不再新增历史 alias，只允许“正式服务面 + 正式命令”组合。

### 3.3 未来可能部分下沉到服务面的能力

1. `file.listSchemas`

原因：

1. 当前更像一次动作型查询。
2. 如果后续 Files、Command Palette、Workspace Surface 都需要共享文件列表和当前文件状态，应该在 `workspace` 中提供只读快照或订阅能力，而不是让多个插件反复执行查询命令。

结论：

1. Phase 3 不急于改造。
2. 等 `workspace` 服务面定义稳定后，再决定是否拆出：
   - `workspace.getCurrentFile()`
   - `workspace.listRecentFiles()`
   - `workspace.subscribe()`

---

## 4. 暂缺但建议补齐的命令

这些命令尚未落地，但已被 Phase 3 计划和快捷键体系依赖：

| 命令 ID | 用途 | 建议阶段 |
|--------|------|---------|
| `commandPalette.open` | 打开命令面板 | Phase 3.3 / 3.4 |
| `editor.copy` | 复制节点 | Phase 3.3 |
| `editor.paste` | 粘贴节点 | Phase 3.3 |
| `editor.cut` | 剪切节点 | Phase 3.3 |
| `editor.deleteNode` | 删除选中节点 | Phase 3.3 |
| `editor.duplicateNode` | 复制节点 | Phase 3.3 |
| `editor.selectAll` | 全选 | Phase 3.3 之后再评估 |
| `editor.deselect` | 取消选中 | Phase 3.3 |

---

## 5. 对 Phase 3.1 的意义

完成本清单后，Phase 3.1 至少有了：

1. 现有命令全量视图
2. 服务面与命令的初步边界样例
3. 后续快捷键和命令面板的目标命令集
