# Shenbi Editor 开发计划

建议执行顺序如下（调整版）：

Phase 0.5 -> Phase 1-MVP -> AI 并行接入 -> Phase 2 -> Phase 3 -> Phase 3.5

- Phase 0.5：Preview 增加 `shell mode`（兼容过渡，不立即移除多场景）
- Phase 1-MVP：先抽最小闭环核心（`schema-editor`/`editor-state`/`event-bus`/`history`/`command`/`create-editor`）
- AI 并行接入：先冻结 AI 接口，避免等到全面插件化后再接导致接口漂移
- Phase 2：迁移 `editor-ui`（先增后删，保留兼容窗口）
- Phase 3：分层插件化（Inspector -> Sidebar -> ActivityBar）
- Phase 3.5：移除过渡适配层与旧入口，完成收口

> 本文档后续内容如与本段冲突，以本段为准。

## 目录

1. [架构总览](#一架构总览)
2. [Phase 0.5：Preview 兼容空壳模式](#二phase-05preview-兼容空壳模式)
3. [Phase 1-MVP：@shenbi/editor-core](#三phase-1-mvpshenbi-editor-core)
4. [AI 接口冻结与适配层](#四ai-接口冻结与适配层)
5. [Phase 2：@shenbi/editor-ui](#五phase-2shenbi-editor-ui)
6. [Phase 3：分层插件化](#六phase-3分层插件化)
7. [Phase 3.5：收口清理](#七phase-35收口清理)
8. [并行开发与分支策略](#八并行开发与分支策略)
9. [验证计划 + DoD + 回滚策略](#九验证计划--dod--回滚策略)

---

## 一、架构总览

### 包依赖关系

```mermaid
graph TD
    APP["apps/preview<br/>业务编排层"]
    UI["@shenbi/editor-ui<br/>React 组件"]
    CORE["@shenbi/editor-core<br/>纯逻辑 + 插件基座"]
    SCHEMA["@shenbi/schema<br/>类型 + 契约"]
    ENGINE["@shenbi/engine<br/>运行时渲染"]

    APP --> UI
    APP --> CORE
    APP --> ENGINE
    UI --> CORE
    UI --> SCHEMA
    CORE --> SCHEMA
    ENGINE --> SCHEMA
```

### editor-core 内部模块拓扑

```mermaid
graph LR
    SE["SchemaEditor"] --> ES["EditorState"]
    EB["EventBus"] --> ES
    ES --> HIS["History"]
    CMD["CommandManager"] --> ES
    CMD --> HIS
    CMD --> EB
    SEL["SelectionManager"] --> ES
    CB["Clipboard"] --> ES
    HK["HotkeyManager"] --> CMD
    DND["DndModel"] --> EB
    PM["PluginManager"] --> CMD
    PM --> EB
    PM --> ES
```

### 当前需要改造的硬编码点

| 文件 | 硬编码内容 | Phase 3 改造方案 |
|------|-----------|-----------------|
| [Inspector.tsx](file:///c:/Users/zk/Code/lowcode/shenbi-codes/shenbi/apps/preview/src/ui/Inspector.tsx) L32-36 | 5 个 Tab 固定写死 | `useContributions('inspector')` |
| [Sidebar.tsx](file:///c:/Users/zk/Code/lowcode/shenbi-codes/shenbi/apps/preview/src/ui/Sidebar.tsx) L27-41 | 3 个 Tab 固定写死 | `useContributions('sidebar')` |
| [ActivityBar.tsx](file:///c:/Users/zk/Code/lowcode/shenbi-codes/shenbi/apps/preview/src/ui/ActivityBar.tsx) L25-29 | 6 个图标固定写死 | `useContributions('activityBar')` |
| [AppShell.tsx](file:///c:/Users/zk/Code/lowcode/shenbi-codes/shenbi/apps/preview/src/ui/AppShell.tsx) L146-209 | Panel 插槽全部硬编码 | LayoutSlot 注册表 |
| [SetterPanel.tsx](file:///c:/Users/zk/Code/lowcode/shenbi-codes/shenbi/apps/preview/src/panels/SetterPanel.tsx) L5-14 | 5 个 `onPatch*` 回调 | `commands.execute()` |

---

## 二、Phase 0.5：Preview 兼容空壳模式

> **目的**：在不破坏现有多场景验收入口的前提下，引入 `shell mode`，让 AI 分支可以并行接入。

### 2.1 改动清单

#### [MODIFY] [App.tsx](file:///c:/Users/zk/Code/lowcode/shenbi-codes/shenbi/apps/preview/src/App.tsx)

**当前状态**（~227 行）：
- 管理 7 个场景 schema（user-management, form-list, tabs-detail 等）
- 场景下拉切换
- ScenarioRuntimeView 渲染

**目标状态（兼容过渡）**：

```tsx
const emptySchema: PageSchema = { id: 'page', name: 'page', body: [] };

export function App() {
  // 兼容模式：保留多场景 + shell mode
  const isShellMode = useMemo(() => getShellModeFromUrlOrFlag(), []);
  const [schema, setSchema] = useState<PageSchema>(
    isShellMode ? emptySchema : scenarioSchemas.userManagement,
  );
  const [selectedNodeId, setSelectedNodeId] = useState<string>();

  // 保留编辑器功能
  const treeNodes = useMemo(() => buildEditorTree(schema), [schema]);
  const selectedNode = useMemo(
    () => getSchemaNodeByTreeId(schema, selectedNodeId),
    [schema, selectedNodeId],
  );
  const selectedContract = useMemo(
    () => selectedNode ? getBuiltinContract(selectedNode.component) : undefined,
    [selectedNode],
  );

  // schema + setSchema 可传递给 AI 组件
  return (
    <AppShell
      sidebarProps={{ contracts: builtinContracts, treeNodes, onSelectNode: setSelectedNodeId, selectedNodeId }}
      inspectorProps={{ selectedNode, contract: selectedContract, onPatchProps: ..., ... }}
      onCanvasSelectNode={handleCanvasSelectNode}
    >
      <ScenarioRuntimeView schema={schema} />
    </AppShell>
  );
}
```

核心变化：
1. 保留多场景管理，同时新增 `shell mode` 开关（URL 参数或 feature flag）
2. `shell mode` 下使用单 `schema` + `setSchema` 状态
3. 保留所有编辑器功能（节点选择、属性修改、画布点击等）
4. `ScenarioRuntimeView` 保留不变
5. demo schema 文件保留（`src/schemas/`）供手动导入

### 2.2 不动的文件

以下文件在 Phase 0.5 中**不改动**：

- `src/ui/*` — 所有 UI 组件保持原样
- `src/panels/*` — 所有面板保持原样
- `src/editor/schema-editor.ts` — 编辑器核心逻辑保持原样
- `src/hooks/*` — hooks 保持原样
- `src/styles/*` — 样式保持原样
- `src/schemas/*` — 保留但不自动加载
- `src/mock/*` — 保留

### 2.3 验证标准

```bash
pnpm --filter @shenbi/preview type-check  # 通过
pnpm --filter @shenbi/preview test        # 通过（可能需更新 App.test.tsx）
pnpm --filter @shenbi/preview dev         # 默认多场景可用；shell mode 可切入
```

---

## 三、Phase 1-MVP：@shenbi/editor-core

> **纯逻辑层**，零 UI 依赖，只依赖 `@shenbi/schema` 类型。

### 3.1 MVP 边界（先做 / 延后）

先做（阻断项）：
- `schema-editor.ts`（从 preview 迁移）
- `event-bus.ts`（CommandManager 的必要依赖）
- `editor-state.ts`
- `history.ts`
- `command.ts`
- `create-editor.ts`（MVP 版，仅组装上述模块）

延后（非阻断项，放 Phase 1.x / 3）：
- `selection.ts`
- `clipboard.ts`
- `hotkeys.ts`
- `dnd.ts`
- `plugin.ts`（先保留最小注册能力，后续再做完整 contribution 体系）

说明：
- 目标是先跑通"状态管理 + 命令执行 + 撤销重做"的最小闭环。
- `event-bus` 虽然代码量小，但它是 `CommandManager` 和 `EditorState` 的通信桥梁，属于 MVP 阻断依赖。
- `history` 默认可先用快照方案落地，但 `EditorCommand` 接口预留可选 `undo` 方法，为后续 `patch/inversePatch` 方案留口子，避免大页面内存抖动。

### 3.2 包配置

#### [NEW] [packages/editor-core/package.json](file:///c:/Users/zk/Code/lowcode/shenbi-codes/shenbi/packages/editor-core/package.json)

```json
{
  "name": "@shenbi/editor-core",
  "version": "0.1.0",
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": { ".": "./src/index.ts" },
  "scripts": {
    "type-check": "tsc -p tsconfig.json --noEmit",
    "test": "vitest run --passWithNoTests"
  },
  "dependencies": { "@shenbi/schema": "workspace:*" },
  "devDependencies": {
    "typescript": "^5.7.3",
    "vitest": "^2.1.9"
  }
}
```

#### [NEW] [packages/editor-core/tsconfig.json](file:///c:/Users/zk/Code/lowcode/shenbi-codes/shenbi/packages/editor-core/tsconfig.json)

继承根 tsconfig，paths 复用 workspace 约定。

### 3.3 模块详情

---

#### [NEW] `src/schema-editor.ts`

**来源**：从 [apps/preview/src/editor/schema-editor.ts](file:///c:/Users/zk/Code/lowcode/shenbi-codes/shenbi/apps/preview/src/editor/schema-editor.ts) 迁移，内容不变。

**导出**：

```typescript
// 类型
export interface EditorTreeNode { id, type, name, children?, isHidden? }

// 树操作
export function buildEditorTree(schema: PageSchema): EditorTreeNode[]
export function getSchemaNodeByTreeId(schema, treeId): SchemaNode | undefined
export function getTreeIdBySchemaNodeId(schema, nodeId): string | undefined
export function getDefaultSelectedNodeId(treeNodes): string | undefined

// 不可变 patch 操作
export function patchSchemaNodeProps(schema, treeId, patch): PageSchema
export function patchSchemaNodeEvents(schema, treeId, patch): PageSchema
export function patchSchemaNodeStyle(schema, treeId, patch): PageSchema
export function patchSchemaNodeLogic(schema, treeId, patch): PageSchema
export function patchSchemaNodeColumns(schema, treeId, columns): PageSchema
```

**测试**：从 [schema-editor.test.ts](file:///c:/Users/zk/Code/lowcode/shenbi-codes/shenbi/apps/preview/src/editor/schema-editor.test.ts) 迁移。

---

#### [NEW] `src/types.ts`

```typescript
/** 资源释放接口，所有注册操作返回 Disposable */
export interface Disposable {
  dispose(): void;
}

/** Contribution Points 扩展点类型 */
export interface PanelContribution {
  id: string;
  slot: 'sidebar' | 'inspector' | 'bottom' | 'ai';
  title: string;
  icon: string;
  order?: number;
  component: unknown; // React.ComponentType，core 层不直接引 React 类型
  when?: () => boolean;
}

export interface TabContribution {
  id: string;
  slot: 'sidebar' | 'inspector';
  label: string;
  icon?: string;
  order?: number;
  component: unknown;
  when?: () => boolean;
}

export interface ActivityBarContribution {
  id: string;
  icon: string;
  tooltip: string;
  order?: number;
  onClick?: () => void;
  badge?: () => number | string | undefined;
}
```

---

#### [NEW] `src/event-bus.ts`

**职责**：类型安全事件总线，模块间解耦通信。

```typescript
export type EditorEventMap = {
  'node:selected':     { nodeId: string };
  'node:deselected':   { nodeId: string };
  'schema:changed':    { schema: PageSchema };
  'command:executed':  { commandId: string };
  'history:pushed':    void;
  'history:undo':      void;
  'history:redo':      void;
  'plugin:activated':  { pluginId: string };
};

export class EventBus<T extends Record<string, unknown>> {
  private handlers: Map<keyof T, Set<Function>>;

  on<K extends keyof T>(event: K, handler: (payload: T[K]) => void): () => void;
  emit<K extends keyof T>(event: K, payload: T[K]): void;
  off<K extends keyof T>(event: K, handler: Function): void;
  clear(): void;
}
```

**测试用例**：
- on/emit 基本收发
- off 取消订阅
- 返回的 unsubscribe 函数正确取消
- clear 清除所有
- 不存在的事件 emit 不报错

---

#### [NEW] `src/editor-state.ts`

**职责**：编辑器状态中枢，管理 schema + 选中节点 + 发布订阅。

```typescript
export interface EditorStateSnapshot {
  schema: PageSchema;
  selectedNodeId?: string;
  canUndo: boolean;   // 由 History 同步写入
  canRedo: boolean;   // 由 History 同步写入
}

export class EditorState {
  constructor(initialSchema: PageSchema);

  // Schema
  getSchema(): PageSchema;
  setSchema(schema: PageSchema): void;

  // 选择
  getSelectedNodeId(): string | undefined;
  setSelectedNodeId(id: string | undefined): void;

  // History 状态（由 CommandManager 在 execute/undo/redo 后同步）
  setHistoryFlags(canUndo: boolean, canRedo: boolean): void;

  // 快照
  getSnapshot(): EditorStateSnapshot;
  restoreSnapshot(snapshot: EditorStateSnapshot): void;

  // 订阅
  subscribe(listener: (state: EditorStateSnapshot) => void): () => void;
}
```

每次 `setSchema` / `setSelectedNodeId` / `setHistoryFlags` 时自动通知所有 subscriber。

> **设计说明**：`canUndo` / `canRedo` 作为 `EditorStateSnapshot` 的派生字段，而非让 UI 层直接持有 `History` 实例。这样 UI 组件（如撤销/重做按钮）只需订阅 snapshot 即可感知 undo/redo 可用状态，保持"单一数据源 -> 订阅快照"的简洁模式。`CommandManager` 在每次 `execute()`/`undo()`/`redo()` 后调用 `state.setHistoryFlags()` 同步状态。

**测试用例**：
- 初始状态正确（canUndo=false, canRedo=false）
- setSchema 触发 subscriber
- setSelectedNodeId 触发 subscriber
- setHistoryFlags 触发 subscriber
- unsubscribe 后不再通知
- getSnapshot / restoreSnapshot 往返正确（含 canUndo/canRedo）

---

#### [NEW] `src/history.ts`

**职责**：基于快照栈的 Undo/Redo，泛型设计可复用。

```typescript
export interface HistoryOptions {
  maxSize?: number;  // 默认 50
}

export class History<T> {
  constructor(initial: T, options?: HistoryOptions);

  push(state: T): void;      // 记录新快照（清除 redo 栈）
  undo(): T | undefined;     // 返回上一个快照，无则返回 undefined
  redo(): T | undefined;     // 返回下一个快照
  canUndo(): boolean;
  canRedo(): boolean;
  getCurrent(): T;
  clear(initial: T): void;   // 重置
  getSize(): number;          // 当前 undo 栈深度
}
```

**实现要点**：
- `undoStack: T[]` + `redoStack: T[]`
- `push()` 清空 `redoStack`
- 超过 `maxSize` 时丢弃最早的快照
- 使用 `structuredClone` 或引用直存（由调用方决定是否 clone）

**测试用例**：
- push -> undo -> redo 完整链路
- canUndo / canRedo 边界
- maxSize 超出时自动丢弃
- undo 后 push 清空 redo 栈
- clear 重置

---

#### [NEW] `src/command.ts`

**职责**：命令注册与执行，所有编辑操作标准化。

```typescript
export interface EditorCommand {
  id: string;
  label: string;
  icon?: string;
  execute(state: EditorState, args?: unknown): void;
  canExecute?(state: EditorState): boolean;
  /** 可选：自定义撤销逻辑，预留给后续 patch/inversePatch 方案 */
  undo?(state: EditorState): void;
}

export class CommandManager {
  constructor(state: EditorState, history: History<EditorStateSnapshot>, eventBus: EventBus);

  register(command: EditorCommand): Disposable;
  execute(commandId: string, args?: unknown): void;
  has(commandId: string): boolean;
  getAll(): EditorCommand[];
}
```

**内置命令**（在 `src/commands/` 子目录或直接内联）：

| Command ID | 说明 |
|-----------|------|
| `editor.undo` | 撤销 |
| `editor.redo` | 重做 |
| `editor.delete` | 删除选中节点 |
| `editor.duplicate` | 复制选中节点 |
| `editor.copy` | 复制到剪贴板 |
| `editor.cut` | 剪切 |
| `editor.paste` | 粘贴 |
| `editor.selectAll` | 全选 |
| `node.patchProps` | 修改属性 |
| `node.patchStyle` | 修改样式 |
| `node.patchEvents` | 修改事件 |
| `node.patchLogic` | 修改逻辑 |
| `node.patchColumns` | 修改列配置 |
| `schema.replace` | 整体替换 schema（供 AI 批量生成使用） |

每次 `execute()` 自动：
1. 执行命令
2. 成功后记录快照到 History（失败则不记录，避免脏历史）
3. 通过 EventBus emit `command:executed`

> **设计说明**：快照在命令成功后记录，而非执行前。这样命令抛异常时不会在 History 中留下无效快照。内部实现采用"先存旧快照 -> 执行命令 -> 成功则 push 旧快照到 undo 栈"的模式。

`schema.replace` 命令约束：
- 入参必须通过最小结构校验（`id`/`name`/`body`）。
- 校验失败或执行异常时抛出错误，不写入 history。
- 成功执行后才写入 history 并发出 `command:executed` 事件。

**测试用例**：
- register + execute 基本流程
- execute 不存在的命令抛错
- canExecute 返回 false 时不执行
- execute 成功后 History 新增快照
- execute 失败（抛异常）后 History 无新增快照
- EventBus 收到 `command:executed` 事件

---

#### [NEW] `src/selection.ts`（Phase 1.x 延后）

**职责**：节点选区管理（单选/多选/范围选）。

```typescript
export class SelectionManager {
  constructor(state: EditorState, eventBus: EventBus);

  select(nodeId: string): void;          // 单选（清除其他）
  toggle(nodeId: string): void;          // Ctrl+Click 切换
  selectRange(fromId: string, toId: string, flatTree: string[]): void;  // Shift+Click
  selectAll(flatTree: string[]): void;
  clear(): void;
  getSelectedIds(): string[];
  isSelected(nodeId: string): boolean;
  getPrimary(): string | undefined;      // 主选中（最后选的）
}
```

**测试用例**：
- select 清除旧选区
- toggle 切换选中/取消
- selectAll 全选
- clear 清空
- EventBus 收到 `node:selected` / `node:deselected`

---

#### [NEW] `src/clipboard.ts`（Phase 1.x 延后）

**职责**：Schema 节点的复制/剪切/粘贴。

```typescript
export class Clipboard {
  copy(nodes: SchemaNode[]): void;
  cut(nodes: SchemaNode[]): void;        // 标记来源以便 paste 时删除
  paste(): SchemaNode[] | null;          // 返回 clone 的副本
  hasContent(): boolean;
  clear(): void;
  isCut(): boolean;
}
```

**实现要点**：
- 内部存储 `structuredClone` 后的副本
- `paste()` 每次返回新 clone，支持多次粘贴
- `cut` 后的首次 `paste` 标记 `isCut=true`，通知调用方删除原节点

---

#### [NEW] `src/hotkeys.ts`（Phase 1.x 延后）

**职责**：快捷键注册、分发、冲突检测。

```typescript
export interface HotkeyBinding {
  key: string;              // e.g. 'ctrl+z', 'meta+shift+d'
  commandId: string;
  label?: string;
  when?: () => boolean;     // 条件激活
}

export class HotkeyManager {
  constructor(commandManager: CommandManager);

  bind(binding: HotkeyBinding): Disposable;
  unbind(key: string): void;
  getBindings(): HotkeyBinding[];
  hasConflict(key: string): boolean;

  attach(target?: HTMLElement | Document): void;  // 默认 document
  detach(): void;
}
```

**性能设计**：

| 要点 | 实现 |
|------|------|
| 查找复杂度 | `Map<normalizedKey, HotkeyBinding>` — O(1) |
| 事件委托 | 单个 `keydown` listener 挂在 target 上 |
| key 标准化 | `normalizeKeyEvent(e)` 预计算，避免每次拼字符串 |
| when 短路 | 先查 Map 再求值 when，无匹配直接返回 |
| 避免冲突 | `hasConflict()` 在 bind 时检测 |
| passive | listener 使用 `{ passive: false }` 以便 `preventDefault` |

```typescript
// 内部实现要点
private handleKeyDown = (e: KeyboardEvent) => {
  const key = normalizeKeyEvent(e);       // "ctrl+z"
  const binding = this.bindingMap.get(key); // O(1)
  if (!binding) return;
  if (binding.when && !binding.when()) return;
  e.preventDefault();
  this.commandManager.execute(binding.commandId);
};
```

**内置热键**：

| 快捷键 | Command |
|--------|---------|
| `Ctrl+Z` | `editor.undo` |
| `Ctrl+Y` / `Ctrl+Shift+Z` | `editor.redo` |
| `Ctrl+C` | `editor.copy` |
| `Ctrl+X` | `editor.cut` |
| `Ctrl+V` | `editor.paste` |
| `Ctrl+D` | `editor.duplicate` |
| `Ctrl+A` | `editor.selectAll` |
| `Delete` / `Backspace` | `editor.delete` |

---

#### [NEW] `src/dnd.ts`（Phase 1.x 延后）

**职责**：拖拽逻辑数据层（与 UI 解耦）。

```typescript
export interface DragPayload {
  type: 'component-insert' | 'node-move';
  sourceNodeId?: string;
  componentType?: string;
}

export interface DropTarget {
  targetNodeId: string;
  position: 'before' | 'after' | 'inside';
}

export class DndModel {
  constructor(eventBus: EventBus);

  startDrag(payload: DragPayload): void;
  updateDrop(target: DropTarget | null): void;
  endDrag(): DropTarget | null;
  cancel(): void;
  isDragging(): boolean;
  getPayload(): DragPayload | null;
  getDropTarget(): DropTarget | null;
}
```

UI 层（Phase 2）会通过 HTML5 DnD API 或 pointer events 调用这些方法。

---

#### [NEW] `src/plugin.ts`（Phase 1.x 延后，MVP 仅保留最小注册能力）

**职责**：插件生命周期管理 + PluginContext（DI 容器）+ Contribution 注册表。

```typescript
export interface EditorPlugin {
  id: string;
  name: string;
  activate(ctx: PluginContext): void;
  deactivate?(): void;
}

export interface PluginContext {
  // 受控 API —— 只读查询 + 通过 commands 修改状态
  readonly schema: PageSchema;
  readonly selectedNodeId: string | undefined;

  // 命令执行（所有状态修改的唯一入口）
  executeCommand(commandId: string, args?: unknown): void;

  // 事件订阅
  subscribe(listener: (snapshot: EditorStateSnapshot) => void): () => void;
  onEvent<K extends keyof EditorEventMap>(event: K, handler: (payload: EditorEventMap[K]) => void): () => void;

  // Contribution Points 注册
  registerPanel(contribution: PanelContribution): Disposable;
  registerTab(contribution: TabContribution): Disposable;
  registerActivityBarItem(contribution: ActivityBarContribution): Disposable;
  registerCommand(command: EditorCommand): Disposable;
  registerHotkey(binding: HotkeyBinding): Disposable;
}
```

> **设计说明**：`PluginContext` 暴露受控 API 而非原始管理器实例。插件通过 `executeCommand()` 修改状态（自动走 History），通过只读属性读取当前状态。这样可以防止插件绕过命令系统直接调用 `state.setSchema()` 而破坏历史记录链。

```typescript
export class PluginManager {
  constructor(deps: {
    state: EditorState;
    commands: CommandManager;
    eventBus: EventBus;
    hotkeys: HotkeyManager;
    selection: SelectionManager;
    clipboard: Clipboard;
  });

  register(plugin: EditorPlugin): void;
  activate(pluginId: string): void;
  activateAll(): void;
  deactivateAll(): void;

  // 查询已注册的 Contributions
  getPanels(slot?: string): PanelContribution[];
  getTabs(slot: string): TabContribution[];
  getActivityBarItems(): ActivityBarContribution[];
}
```

---

#### [NEW] `src/create-editor.ts`

**职责**：工厂函数，一键创建编辑器实例。

**MVP 版本**（Phase 1-MVP）：仅组装核心模块。

```typescript
export interface CreateEditorOptions {
  initialSchema?: PageSchema;
  historyMaxSize?: number;
}

/** MVP：最小闭环 */
export function createEditor(options?: CreateEditorOptions): {
  state: EditorState;
  history: History<EditorStateSnapshot>;
  commands: CommandManager;
  eventBus: EventBus<EditorEventMap>;
  destroy(): void;
}
```

**完整版本**（Phase 1.x 后逐步扩展）：

```typescript
export interface CreateEditorOptions {
  initialSchema?: PageSchema;
  plugins?: EditorPlugin[];
  historyMaxSize?: number;
}

/** 完整版：包含所有子系统 */
export function createEditor(options?: CreateEditorOptions): {
  state: EditorState;
  history: History<EditorStateSnapshot>;
  commands: CommandManager;
  eventBus: EventBus<EditorEventMap>;
  hotkeys: HotkeyManager;
  selection: SelectionManager;
  clipboard: Clipboard;
  dnd: DndModel;
  plugins: PluginManager;
  destroy(): void;
}
```

> **说明**：MVP 阶段 `createEditor` 只返回 `state`/`history`/`commands`/`eventBus`/`destroy`。延后模块在 Phase 1.x 按需接入后逐步补全返回类型。避免 MVP 返回值包含尚未实现的模块。

---

#### [NEW] `src/index.ts`

```typescript
// MVP 导出
export * from './types';
export * from './schema-editor';
export * from './event-bus';
export * from './editor-state';
export * from './history';
export * from './command';
export * from './create-editor';

// Phase 1.x 逐步启用时再补充导出：selection / clipboard / hotkeys / dnd / plugin
```

---

## 四、AI 接口冻结与适配层

> **目的**：不等 Phase 3 全面插件化，先冻结 AI 接口，避免并行开发期间接口反复改动。
>
> **时机**：Phase 1-MVP 完成后即可启用，AI 分支在此基础上并行开发。

### 4.1 冻结接口（v1）

```typescript
export interface EditorAIBridge {
  /** 获取当前完整 schema */
  getSchema(): PageSchema;

  /** 获取当前选中节点 */
  getSelectedNodeId(): string | undefined;

  /** 获取可用组件列表及其属性契约，AI 据此生成合法 schema */
  getAvailableComponents(): ComponentContract[];

  /** 执行编辑器命令（自动记录历史），返回执行结果 */
  execute(commandId: string, args?: unknown): ExecuteResult;

  /** 整体替换 schema（内部走 schema.replace 命令，记录历史） */
  replaceSchema(schema: PageSchema): void;

  /** 订阅状态变化，listener 接收最新快照（含 schema + selectedNodeId） */
  subscribe(listener: (snapshot: EditorStateSnapshot) => void): () => void;
}

export interface ExecuteResult {
  success: boolean;
  error?: string;
}
```

**相较于旧版的改进**：
- `subscribe` 的 listener 携带 `EditorStateSnapshot` 参数，订阅者无需每次全量 `getSchema()`
- 新增 `getAvailableComponents()`，AI 可以查询可用组件契约来生成合法 schema
- 新增 `replaceSchema()`，AI 生成整页时无需拆成多个 patch 命令
- `execute()` 返回 `ExecuteResult`，AI 可以感知操作成败并做出相应处理

`replaceSchema` 执行规则：
- 内部统一映射到 `commands.execute('schema.replace', { schema })`。
- `commands.execute()` 抛出的错误由 bridge adapter 捕获并转换为 `ExecuteResult.error`。
- 校验与错误处理规则见上文 3.3 `src/command.ts` 小节中的 `schema.replace` 约束。

### 4.2 适配策略

- Phase 0.5~2：由 `apps/preview` 提供 bridge adapter，内部桥接到 `EditorState` + `CommandManager`。
- Phase 3 后：由 `PluginContext` 提供 bridge adapter（接口保持不变）。
- 禁止 AI 分支直接耦合 `panels/*`、`ui/*` 内部实现。

---

## 五、Phase 2：@shenbi/editor-ui

> **React 组件层**，依赖 `editor-core` + `@shenbi/schema` + `lucide-react`。CSS 不打包，消费端提供 Tailwind。

### 5.1 包配置

#### [NEW] [packages/editor-ui/package.json](file:///c:/Users/zk/Code/lowcode/shenbi-codes/shenbi/packages/editor-ui/package.json)

```json
{
  "name": "@shenbi/editor-ui",
  "version": "0.1.0",
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": { ".": "./src/index.ts" },
  "dependencies": {
    "@shenbi/schema": "workspace:*",
    "@shenbi/editor-core": "workspace:*",
    "lucide-react": "^0.575.0"
  },
  "peerDependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  }
}
```

### 5.2 CSS / Tailwind 集成说明

`editor-ui` 组件使用 Tailwind class，但包本身不打包 CSS。消费端需要：

1. **Tailwind content 配置**：同时覆盖 workspace 联调路径与 node_modules 安装路径
2. **导入 `preview-ide.css`**：`import '@shenbi/editor-ui/styles/preview-ide.css'`（自定义 CSS 变量等）
3. 迁移后 `preview-ide.css` 中仅保留与编辑器布局相关的自定义样式，Tailwind utility 不需额外处理

```typescript
// apps/preview/tailwind.config.ts
export default {
  content: [
    './src/**/*.{ts,tsx}',
    '../../packages/editor-ui/src/**/*.{ts,tsx}',          // workspace 开发
    './node_modules/@shenbi/editor-ui/src/**/*.{ts,tsx}',  // 安装包消费
  ],
};
```

### 5.3 文件迁移清单

| 目标位置 | 来源 | 文件 |
|---------|------|------|
| `src/panels/` | `preview/src/panels/` | SetterPanel.tsx, ComponentPanel.tsx, SchemaTree.tsx, ActionPanel.tsx, PagePanel.tsx, index.ts |
| `src/shell/` | `preview/src/ui/` | AppShell.tsx, Sidebar.tsx, Inspector.tsx, TitleBar.tsx, ActivityBar.tsx, Console.tsx, StatusBar.tsx, EditorTabs.tsx, WorkbenchToolbar.tsx, AIPanel.tsx |
| `src/hooks/` | `preview/src/hooks/` | useResize.ts |
| `src/styles/` | `preview/src/styles/` | preview-ide.css |

### 5.4 新增文件

#### [NEW] `src/context/EditorProvider.tsx`

```tsx
import { createContext, useContext, useMemo } from 'react';
import type {
  CommandManager, EditorEventMap, EditorState, EditorStateSnapshot,
  EventBus, History,
} from '@shenbi/editor-core';
import type { PageSchema } from '@shenbi/schema';

/**
 * Phase 2 Context —— API 形状对齐 PluginContext，降低 Phase 3 迁移成本。
 *
 * UI 组件优先使用 executeCommand() / subscribe() / 只读属性，
 * Phase 3 切换 provider 实现时零改动。
 * commands / eventBus / history 仅作为 Phase 2 临时逃生口，Phase 3 移除。
 */
export interface EditorCoreContextValue {
  // ── 对齐 PluginContext 的稳定 API ──
  readonly schema: PageSchema;
  readonly selectedNodeId: string | undefined;
  executeCommand(commandId: string, args?: unknown): void;
  subscribe(listener: (snapshot: EditorStateSnapshot) => void): () => void;

  // ── Phase 2 临时保留，Phase 3 移除 ──
  /** @deprecated Phase 3 后由 PluginContext 内部托管，届时删除 */
  commands: CommandManager;
  /** @deprecated Phase 3 后由 PluginContext.onEvent() 替代 */
  eventBus: EventBus<EditorEventMap>;
  /** @deprecated Phase 3 后由快照的 canUndo/canRedo 替代直接访问 */
  history: History<EditorStateSnapshot>;
}

const EditorContext = createContext<EditorCoreContextValue | null>(null);

export function EditorProvider({ editor, children }) {
  const value: EditorCoreContextValue = useMemo(() => ({
    get schema() { return editor.state.getSchema(); },
    get selectedNodeId() { return editor.state.getSelectedNodeId(); },
    executeCommand: (id, args) => editor.commands.execute(id, args),
    subscribe: (listener) => editor.state.subscribe(listener),
    // Phase 2 临时逃生口
    commands: editor.commands,
    eventBus: editor.eventBus,
    history: editor.history,
  }), [editor]);

  return (
    <EditorContext.Provider value={value}>
      {children}
    </EditorContext.Provider>
  );
}

export function useEditorContext(): EditorCoreContextValue {
  const ctx = useContext(EditorContext);
  if (!ctx) throw new Error('useEditorContext must be used within EditorProvider');
  return ctx;
}
```

> **迁移策略**：Phase 2 先使用 `EditorCoreContextValue`（不依赖 `plugin.ts`）。UI 组件优先调用 `executeCommand()` / `subscribe()` / 只读属性；Phase 3 插件系统稳定后，将 provider 内部实现切换为 `PluginContext`，移除标记 `@deprecated` 的字段，UI 代码无需改动。

#### [NEW] `src/hooks/useEditor.ts`

```tsx
/** 获取 EditorState 的响应式 hook，state 变化自动 re-render */
export function useEditorState() {
  const ctx = useEditorContext();
  const [snapshot, setSnapshot] = useState<EditorStateSnapshot>({
    schema: ctx.schema,
    selectedNodeId: ctx.selectedNodeId,
    canUndo: false,
    canRedo: false,
  });
  useEffect(() => ctx.subscribe(setSnapshot), [ctx]);
  return snapshot;
}
```

#### [NEW] `src/hooks/useContributions.ts`

```tsx
/** 获取某个 slot 的已注册 Tab/Panel，用于动态渲染 */
export function useContributions<T>(slot: string): T[] { ... }
```

### 5.5 apps/preview 更新

#### [MODIFY] [package.json](file:///c:/Users/zk/Code/lowcode/shenbi-codes/shenbi/apps/preview/package.json)

```diff
 "dependencies": {
+  "@shenbi/editor-core": "workspace:*",
+  "@shenbi/editor-ui": "workspace:*",
   "@shenbi/engine": "workspace:*",
   "@shenbi/schema": "workspace:*",
```

#### [MODIFY] [App.tsx](file:///c:/Users/zk/Code/lowcode/shenbi-codes/shenbi/apps/preview/src/App.tsx)

```diff
-import { AppShell } from './ui/AppShell';
-import { buildEditorTree, ... } from './editor/schema-editor';
+import { AppShell, EditorProvider } from '@shenbi/editor-ui';
+import { createEditor, buildEditorTree, ... } from '@shenbi/editor-core';
```

#### [DELETE] 已迁移文件

- `src/editor/` -> `@shenbi/editor-core`
- `src/panels/` -> `@shenbi/editor-ui`
- `src/ui/` -> `@shenbi/editor-ui`
- `src/hooks/` -> `@shenbi/editor-ui`
- `src/styles/` -> `@shenbi/editor-ui`

> [!TIP]
> 采用「先增后删」策略：Phase 2 第一个 PR 只增不删（改 import），第二个 PR 删旧文件。这样与 AI 分支不冲突。

---

## 六、Phase 3：分层插件化

> 所有 Panel/Tab/Icon 改为 Contribution Points 动态注册。

分层顺序（必须按顺序推进）：
1. 先改 `Inspector` 为动态 Tab（风险最小，收益最高）
2. 再改 `Sidebar` 为动态 Tab（验证左侧生态扩展）
3. 最后改 `ActivityBar` 为动态图标（全局导航改动最大）
4. `SetterPanel onPatch -> commands` 可提前落地，但需保留 fallback

### 6.1 UI 组件改造

**Inspector.tsx**：
```diff
-<TabItem label="Props" ... />
-<TabItem label="Style" ... />
-// ...硬编码 5 个 tab
+const tabs = useContributions<TabContribution>('inspector');
+{tabs.sort((a,b) => (a.order ?? 0) - (b.order ?? 0)).map(tab => (
+  <TabItem key={tab.id} label={tab.label} ... />
+))}
```

**Sidebar.tsx**：同理，`useContributions('sidebar')`。

**ActivityBar.tsx**：同理，`useContributions('activityBar')`。

**SetterPanel.tsx**：
```diff
-onPatchProps?.({ title: 'hello' });
+const { executeCommand } = useEditorContext();
+executeCommand('node.patchProps', { title: 'hello' });
```

### 6.2 内置插件

现有功能以内置插件形式提供（向下兼容）：

```typescript
// builtin-plugins.ts
export const builtinPlugins: EditorPlugin[] = [
  {
    id: 'builtin.inspector.props',
    name: 'Props Inspector Tab',
    activate(ctx) {
      ctx.registerTab({
        id: 'inspector-props', slot: 'inspector',
        label: 'Props', order: 1,
        component: PropsSetter,
      });
    },
  },
  // ... style, events, logic, actions
  // ... sidebar 的 components, outline, data
  // ... activityBar 的 6 个图标
  // ... 所有内置热键
];
```

### 6.3 AI 插件接入

AI 分支开发完成后，只需添加：

```typescript
export const aiPlugin: EditorPlugin = {
  id: 'shenbi.ai-page-gen',
  name: 'AI Page Generator',
  activate(ctx) {
    ctx.registerPanel({
      id: 'ai-panel', slot: 'ai',
      title: 'AI 生成', icon: 'Sparkles',
      component: AIPageGenerator,
    });
    ctx.registerCommand({
      id: 'ai.generate', label: 'AI 生成页面',
      execute: (state) => { /* ... */ },
    });
    ctx.registerHotkey({ key: 'ctrl+shift+g', commandId: 'ai.generate' });
  },
};
```

在 `App.tsx` 中：
```typescript
const editor = createEditor({ plugins: [...builtinPlugins, aiPlugin] });
```

---

## 七、Phase 3.5：收口清理

> **目的**：移除所有过渡适配层和旧入口，完成代码路径收敛。
>
> **前置条件**：Phase 3 全部落地且回归测试全绿。

### 7.1 删除清单

| 类别 | 删除内容 | 说明 |
|------|---------|------|
| 兼容代码 | `apps/preview` 中旧的 `import` 路径别名 | 已由 `@shenbi/editor-core` / `editor-ui` 替代 |
| 过渡文件 | `apps/preview/src/editor/` 残留文件 | 已迁移至 `editor-core` |
| 过渡文件 | `apps/preview/src/ui/`、`src/panels/`、`src/hooks/`、`src/styles/` 残留文件 | 已迁移至 `editor-ui` |
| 适配层 | Phase 0.5 的 `shell mode` 开关逻辑 | 编辑器统一入口后不再需要 |
| 适配层 | `EditorAIBridge` 的 preview adapter | Phase 3 后由 `PluginContext` 直接提供 |
| Fallback | `SetterPanel` 中保留的 `onPatch*` 回调 fallback | 已全面切换为 `commands.execute()` |
| demo 数据 | `src/schemas/` 中的场景 schema（可选保留为测试 fixtures） | 评估是否仍需要 |

### 7.2 收口步骤

1. **创建 `feature/editor-cleanup` 分支**
2. **打 tag**：删除前在当前 main 上打 `pre-cleanup` tag，作为回滚锚点
3. **逐目录清理**：按上表逐项删除，每删一个目录跑一次 type-check + test
4. **更新文档**：同步 README、CONTRIBUTING 中的架构说明
5. **全量回归**：`pnpm -r type-check && pnpm -r test`
6. **合并到 main**

### 7.3 验证标准

```bash
pnpm -r type-check          # 全包类型检查通过
pnpm -r test                 # 全包测试通过
# 手动验证：
# - 编辑器基础流程（选中/属性修改/撤销重做）正常
# - AI 面板正常加载和交互
# - 无 console 错误或 404 资源
```

---

## 八、并行开发与分支策略

```
main ──────┬────────────────────────────────────────────►
           │
           ├─ feature/editor-shell-mode ── Phase 0.5 ── merge ─►
           │                                           │
           │                                           ├─ feature/ai-page-gen
           │                                           │    仅依赖 EditorAIBridge
           │                                           │
           │                                           ├─ feature/editor-core-mvp
           │                                           │    Phase 1-MVP
           │                                           │
           │                                           ├─ feature/editor-ui-migrate
           │                                           │    Phase 2（先增后删）
           │                                           │
           │                                           └─ feature/editor-plugins
           │                                                Phase 3（分层推进）
           │
           └─ feature/editor-cleanup ── Phase 3.5（收口）──►
```

**冲突规避原则**：
- Editor 分支：先增后删
- AI 分支：新代码放 `src/ai/`，不改 `panels/`、`ui/` 已有文件
- AI 只依赖 `EditorAIBridge`，禁止直接引用 preview 内部面板实现
- 统一以 `commands.execute()` 作为跨层修改入口，减少并发改动冲突

---

## 九、验证计划 + DoD + 回滚策略

### 9.1 验证命令

| Phase | 验证命令 | 预期 |
|-------|---------|------|
| 0.5 | `pnpm --filter @shenbi/preview type-check` | 通过 |
| 0.5 | `pnpm --filter @shenbi/preview test` | 通过 |
| 0.5 | `pnpm --filter @shenbi/preview dev` | 默认多场景可用；shell mode 可用 |
| 1-MVP | `pnpm --filter @shenbi/editor-core type-check` | 通过 |
| 1-MVP | `pnpm --filter @shenbi/editor-core test` | 核心模块单测通过 |
| 2 | `pnpm --filter @shenbi/editor-ui type-check` | 通过 |
| 2 | `pnpm --filter @shenbi/preview test` | 通过（迁移后无功能退化） |
| 3 | 同上 + 手动验证 contribution 注册 | Inspector/Sidebar/ActivityBar 分层生效 |
| 3.5 | `pnpm -r type-check && pnpm -r test` | 通过（收口后回归） |

### 9.2 DoD（Definition of Done）

| Phase | DoD |
|------|-----|
| 0.5 | 现有多场景链路可用；shell mode 可切入；无回归 |
| 1-MVP | 完成最小闭环（event-bus/state/history/command/create-editor/schema-editor）；接口文档齐全 |
| AI 接入 | `EditorAIBridge` v1 接口冻结；bridge adapter 就绪；AI 分支可独立开发 |
| 2 | `editor-ui` 接入后通过回归，旧实现保留一个兼容窗口 |
| 3 | 三层插件化按顺序落地，Setter 改走 command（保留 fallback） |
| 3.5 | 移除过渡 adapter/旧入口，代码路径收敛，`pre-cleanup` tag 保留，文档同步 |

### 9.3 回滚策略

- Phase 0.5：通过 `shell mode` 开关回退到原多场景入口。
- Phase 1/2：保留旧 `preview` 实现一个兼容周期，必要时回切 import。
- Phase 3：每层插件化独立开关，支持按层回退（不一次性回滚全量）。
- Phase 3.5：仅在回归全绿后删除旧路径，删除前保留 `pre-cleanup` tag，极端情况可 `git revert` 回到 tag。
