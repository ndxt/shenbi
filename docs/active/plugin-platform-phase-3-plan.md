# 插件平台 Phase 3 框架搭建计划

> 目标：在继续扩展 Files / Setter / AI 等插件能力前，先搭好稳定的平台框架，避免后续一边做功能一边修改协议。

---

## 1. 当前判断

1. `PluginContext` 兼容层已基本收口，`document / selection / commands / notifications` 已成为当前稳定服务面。
2. 当前不宜直接进入具体业务增强，否则大概率会倒逼平台接口再次震荡。
3. Phase 3 的第一阶段，应先完成"插件平台框架搭建"，再进入具体插件能力迭代。
4. `PluginShortcutContribution` 已有类型定义，但宿主层尚无键盘事件监听与快捷键分发实现——**快捷键体系是 Phase 3 必须补齐的基础设施**。

---

## 2. 目标与边界

### 2.1 目标

1. 固定插件平台的分层模型，明确宿主、平台服务、插件能力三层边界。
2. 规划下一批标准服务面，避免业务插件重复向宿主取私有能力。
3. 固定插件生命周期、注册协议和贡献模型。
4. 明确"直接服务调用"和"命令总线调用"的职责边界。
5. 建立统一扩展点清单与最小插件模板。
6. **落地快捷键体系**，打通 `PluginShortcutContribution → 宿主监听 → 命令执行` 全链路。

### 2.2 非目标

1. 本轮不直接实现复杂 Files / Setter / AI 新功能。
2. 本轮不重做 `editor-ui` 或现有插件目录结构。
3. 本轮不引入破坏性插件 API v2。
4. 本轮不做快捷键可视化编辑 UI，只落地运行时引擎和协议。

---

## 3. 目标架构

### 3.1 三层模型

| 层级 | 包路径 | 职责 |
|------|--------|------|
| Host Layer | `packages/editor-ui` | 壳层布局、扩展点容器、生命周期调度、统一命令分发、**键盘事件监听** |
| Platform Layer | `packages/editor-plugins/api` | 插件协议、标准服务面、贡献类型、注册约定、**快捷键协议定义** |
| Plugin Layer | `packages/editor-plugins/*` | Files / Setter / AI 等具体能力实现、**插件级快捷键声明** |

### 3.2 基本约束

1. 业务插件不得直接依赖宿主私有实现。
2. 新增平台能力优先落到 `editor-plugin-api`，而不是散落在 `apps/preview` 或 `editor-ui`。
3. 宿主层只提供稳定服务面和扩展点，不回流具体业务逻辑。
4. 插件不得自行监听全局键盘事件，**所有快捷键必须通过 `shortcuts` contribution 声明**。

---

## 4. 核心框架议题

### 4.1 平台服务面规划

**现有稳定服务面：**

| 服务面 | 职责 | 为什么不能只用 command |
|--------|------|----------------------|
| `document` | Schema 读写、节点属性修补 | 高频同步读写，command 的序列化开销不可接受 |
| `selection` | 当前选中节点、选区变更订阅 | 需要同步返回值和事件订阅，command 不支持 |
| `commands` | 命令执行入口 | 本身就是命令总线 |
| `notifications` | 统一消息通知入口 | 当前接口是 fire-and-forget 通知；若后续需要消息生命周期控制，再单独评估扩展返回句柄 |

**待评估的下一批标准服务面：**

| 服务面 | 职责 | 准入理由 |
|--------|------|---------|
| `workspace` | 当前文件状态、脏标记、工作区模式 | 多插件共享的只读状态，轮询 command 成本过高 |
| `navigation` | 面板切换、活动视图切换、打开指定扩展点 | 需要同步 UI 反馈，command 无法保证时序 |
| `storage` | 本地持久化、用户偏好、插件配置缓存 | 异步 KV 操作，command 语义不匹配 |
| `clipboard` | 复制、粘贴、跨插件共享的数据载体 | 需要类型安全的 MIME 数据协议，command 无法表达 |
| `overlay` | modal / drawer / popconfirm / prompt | 需要 Promise 返回用户决策，command 无法等待结果 |

**`workspace` 拆分建议：** 若后续发现"文件状态"和"工作区模式"关注点差异过大，可拆为 `workspace.files` 和 `workspace.mode` 子命名空间，但初始版本先合并为一个服务面。

**`overlay` 抽象约束：** overlay 只暴露声明式意图接口（描述 what），渲染实现（how）留在宿主层。插件调用 `overlay.confirm({ title, content })` 返回 `Promise<boolean>`，不关心底层用了 antd 还是自定义组件。

**准入规则：**

1. 每个服务面必须有明确职责边界。
2. 每个服务面必须回答"为什么不能只用 command"。
3. 不满足跨插件复用价值的能力，不进入标准服务面。
4. 新服务面的接入不超过 20 行胶水代码。

### 4.2 命令总线与直接服务边界

**判定规则：**

| 维度 | 走直接服务 | 走命令总线 |
|------|-----------|-----------|
| 频率 | 高频调用（每次交互都会触发） | 低频或按需触发 |
| 时序 | 需要同步返回值 | 可异步、可延迟 |
| 消费方 | 调用方明确需要结果 | 可广播、可跨插件路由 |
| 状态 | 读写明确的核心数据 | 不承载业务状态拼装 |
| 绑定 | 与特定服务面强关联 | 可被快捷键、菜单、命令面板触发 |

**需要落地的产物：**

1. 一份"服务 vs 命令"判定规则文档。
2. 一份已有命令清单的归类结果。
3. 一份新增服务面的准入评审模板。

### 4.3 生命周期与激活机制

**当前状态：** 插件仅有 `activate` 入口，通过返回清理函数实现简易销毁，缺少显式的 register / deactivate / dispose 阶段。

**目标最小生命周期：**

```
register → activate → deactivate → dispose
```

| 阶段 | 时机 | 职责 | 允许的操作 |
|------|------|------|-----------|
| `register` | 插件清单加载时 | 声明贡献、注册静态信息 | 只读，不允许调用服务 |
| `activate` | 扩展点首次可见或手动激活 | 启动运行时逻辑、订阅事件 | 可调用全部服务 |
| `deactivate` | 扩展点隐藏或手动停用 | 暂停运行时逻辑、暂存状态 | 可调用 storage |
| `dispose` | 插件卸载 | 释放全部资源、取消全部订阅 | 只允许清理 |

**异常处理策略：**

| 场景 | 策略 |
|------|------|
| `activate` 抛出异常 | 标记插件为 `error` 状态，通过 `notifications.error` 告知用户，不影响其他插件 |
| `activate` 返回的 Promise reject | 同上 |
| `deactivate` / `dispose` 抛出异常 | 记录错误日志，强制释放该插件资源，继续其他插件的清理 |

### 4.4 贡献模型统一

**已有贡献类型（代码已实现）：**

| 类型 | 接口 | 状态 |
|------|------|------|
| `activityBarItems` | `ActivityBarItemContribution` | 已落地 |
| `sidebarTabs` | `SidebarTabContribution` | 已落地 |
| `inspectorTabs` | `InspectorTabContribution` | 已落地 |
| `auxiliaryPanels` | `AuxiliaryPanelContribution` | 已落地 |
| `commands` | `PluginCommandContribution` | 已落地 |
| `shortcuts` | `PluginShortcutContribution` | **仅有类型，无运行时** |

**待新增贡献类型：**

| 类型 | 说明 | 优先级 |
|------|------|--------|
| `menus` | 工具栏菜单项 | P1 |
| `commandPalette` | 命令面板条目 | P1 |
| `contextMenus` | 右键上下文菜单 | P2 |

**声明载体：** 所有贡献通过 `EditorPluginManifest.contributes` 对象静态声明，类型由 `PluginContributes` 接口约束。动态能力（如条件显隐）只能通过 `when` 表达式补充状态，不改协议结构。

**统一标识体系：**

1. 命令 ID 格式：`{pluginId}.{action}`，如 `shenbi.plugin.files.open`。
2. 快捷键的 `commandId` 必须引用已注册的命令 ID。
3. 菜单项的 `command` 字段同样引用命令 ID。
4. 三者共享同一个命令注册表，确保 ID 不冲突。

### 4.5 快捷键体系设计

> 这是 Phase 3 必须补齐的核心基础设施。当前 `PluginShortcutContribution` 仅有类型定义，宿主层无任何键盘事件处理。

#### 4.5.1 协议层（Platform Layer）

**现有类型（无需修改）：**

```typescript
// packages/editor-plugins/api/src/plugin.ts
interface PluginShortcutContribution {
  id: string;
  commandId: string;    // 引用已注册的命令 ID
  keybinding: string;   // 快捷键描述串
  order?: number;
  when?: string;         // 条件表达式
}
```

**keybinding 格式规范：**

| 格式 | 示例 | 说明 |
|------|------|------|
| 单键 | `Delete` | 单个按键 |
| 修饰键+键 | `Ctrl+S` | 修饰键组合 |
| 多修饰键 | `Ctrl+Shift+Z` | 多个修饰键 |
| 跨平台修饰键 | `Mod+S` | `Mod` = macOS 下 `Cmd`，其他平台 `Ctrl` |

**修饰键标准名称：** `Ctrl`、`Shift`、`Alt`、`Mod`（跨平台主修饰键）。

**按键标准名称：** 使用 `KeyboardEvent.key` 标准值，大写字母键用大写字母（`A`-`Z`），特殊键用标准名（`Delete`、`Backspace`、`Enter`、`Escape`、`ArrowUp` 等）。

#### 4.5.2 运行时引擎（Host Layer）

宿主层需要实现一个 `ShortcutManager`，职责如下：

```
插件声明 shortcuts → collectPluginContributes 收集
→ ShortcutManager 构建快捷键映射表
→ 全局 keydown 监听 → 匹配 → 执行对应 command
```

**核心能力：**

| 能力 | 说明 |
|------|------|
| 快捷键注册 | 从 `ResolvedPluginContributes.shortcuts` 构建 `keybinding → commandId` 映射 |
| 键盘事件解析 | 将 `KeyboardEvent` 标准化为 keybinding 描述串进行匹配 |
| 冲突检测 | 多个插件注册同一快捷键时，按 `order` 优先级取最高者，开发模式下 console.warn |
| `when` 条件求值 | 根据当前编辑器上下文（如 `editorFocused`、`sidebarVisible`）判断快捷键是否激活 |
| 命令执行 | 匹配成功后调用 `commands.execute(commandId)` |
| 阻止默认行为 | 匹配成功时 `preventDefault()`，避免浏览器默认快捷键冲突 |

**`when` 条件上下文（初始集合）：**

| 变量 | 类型 | 说明 |
|------|------|------|
| `editorFocused` | boolean | 编辑器画布是否聚焦 |
| `sidebarVisible` | boolean | 侧边栏是否展开 |
| `inspectorVisible` | boolean | 属性面板是否展开 |
| `hasSelection` | boolean | 是否有选中节点 |
| `inputFocused` | boolean | 是否有 input / textarea 聚焦（用于避免快捷键拦截文本输入） |

**`inputFocused` 特殊处理：** 当 `inputFocused === true` 时，默认屏蔽所有快捷键；只有 shortcut 显式声明 `when: "inputFocused"`，或其 `when` 表达式明确包含并允许 `inputFocused` 条件时，才继续匹配。这确保用户在输入框中打字时不会被快捷键意外拦截。

#### 4.5.3 建议内置快捷键映射

以下为平台建议内置的基础快捷键映射。其中只有部分命令当前已存在；其余需要先补对应命令，再接入快捷键绑定。

| 快捷键 | 命令 | 说明 | 当前状态 |
|--------|------|------|----------|
| `Mod+Z` | `editor.undo` | 撤销 | 已存在 |
| `Mod+Shift+Z` | `editor.redo` | 重做 | 已存在 |
| `Mod+S` | `file.saveSchema` | 保存当前文件 | 已存在 |
| `Mod+Shift+S` | `file.saveAs` | 另存为 | 已存在 |
| `Mod+C` | `editor.copy` | 复制节点 | 待补命令 |
| `Mod+V` | `editor.paste` | 粘贴节点 | 待补命令 |
| `Mod+X` | `editor.cut` | 剪切节点 | 待补命令 |
| `Delete` / `Backspace` | `editor.deleteNode` | 删除选中节点 | 待补命令 |
| `Mod+D` | `editor.duplicateNode` | 复制并粘贴节点 | 待补命令 |
| `Mod+A` | `editor.selectAll` | 全选 | 待补命令 |
| `Mod+P` | `commandPalette.open` | 打开命令面板 | 待补命令 |
| `Escape` | `editor.deselect` | 取消选中 | 待补命令 |

#### 4.5.4 插件声明示例

```typescript
defineEditorPlugin({
  id: 'shenbi.plugin.files',
  name: 'Files Plugin',
  contributes: {
    commands: [
      {
        id: 'shenbi.plugin.files.open',
        title: 'Open File',
        execute: (ctx) => { /* ... */ },
      },
    ],
    shortcuts: [
      {
        id: 'shenbi.plugin.files.shortcut.open',
        commandId: 'shenbi.plugin.files.open',
        keybinding: 'Mod+O',
        when: 'editorFocused',
      },
    ],
  },
});
```

### 4.6 扩展点清单

P3 第一阶段要先冻结扩展点，而不是直接做某个插件能力。

**优先级排序：**

| 优先级 | 扩展点 | 依赖 |
|--------|--------|------|
| P0 | **Shortcuts（快捷键）** | 所有可触发动作的基础设施 |
| P1 | Command Palette | 依赖命令注册表 + 快捷键展示 |
| P1 | Toolbar / Menu | 依赖命令注册表 |
| P2 | Context Menu | 依赖命令注册表 + 选区上下文 |
| P3 | Workspace Surface | 依赖 workspace 服务面 |
| P3 | Inspector Sections | 已有基础，增量补齐 |

---

## 5. 分阶段计划

### Phase 3.1：平台边界冻结

**产物：**

1. 平台三层边界说明文档。
2. 平台服务面清单与职责定义（含准入规则）。
3. "服务 vs 命令"判定规则文档。

**验收：**

1. 新增平台能力时能明确归位到 Host / Platform / Plugin 三层之一。
2. 新能力是否进 `PluginContext` 有统一判定标准。
3. 每个待纳入服务面都能回答"为什么不能只用 command"。

### Phase 3.2：生命周期与贡献协议固定

**产物：**

1. 插件四阶段生命周期约定（register / activate / deactivate / dispose）。
2. 生命周期异常处理策略。
3. contribution 类型完整清单（含已有 + 待新增）。
4. 统一标识体系规范（命令 ID 格式、引用关系）。
5. 快捷键 keybinding 格式规范。

**验收：**

1. 新插件不需要额外阅读宿主实现也能理解接入流程。
2. 不同插件对同一扩展点的接入方式保持一致。
3. `PluginShortcutContribution` 的声明格式已冻结，后续只增不改。

### Phase 3.3：快捷键引擎与框架样板

**产物：**

1. `ShortcutManager` 运行时实现（宿主层）。
2. 内置快捷键注册（undo / redo / save / copy / paste / delete 等）。
3. `when` 条件上下文求值器。
4. 一个最小插件模板（含 command + shortcut 声明示例）。
5. 一份插件接入文档。

**验收：**

1. 插件声明的 `shortcuts` 能实际触发对应 `command`。
2. `when` 条件能正确控制快捷键激活/屏蔽。
3. 内置快捷键覆盖 undo / redo / save / copy / paste / delete。
4. `inputFocused` 场景下不误拦截文本输入。
5. 能用模板在 30 分钟内接入一个含快捷键的新插件。

### Phase 3.4：扩展点骨架落地

**产物：**

1. `Command Palette` 骨架（列出所有已注册命令，展示快捷键绑定）。
2. `menus / contextMenus` 的协议骨架。
3. 对应的宿主容器接线。

**验收：**

1. 扩展点可以注册空实现并完成宿主渲染。
2. Command Palette 能展示命令列表及其绑定的快捷键。
3. 不要求业务功能完整，但协议与接线必须闭环。

---

## 6. 建议执行顺序

1. 先出平台边界和服务面文档（Phase 3.1）。
2. 再固定生命周期、contribution 规范与快捷键协议（Phase 3.2）。
3. 然后实现 `ShortcutManager`，补模板和宿主适配（Phase 3.3）。
4. 最后接 Command Palette / Menu / Context Menu 等扩展点骨架（Phase 3.4）。

> 快捷键引擎是 Command Palette 的前置依赖——命令面板需要展示每条命令绑定的快捷键，因此 `ShortcutManager` 必须在 Command Palette 之前完成。

---

## 7. 交付物清单

| # | 交付物 | 所属阶段 |
|---|--------|---------|
| 1 | 本规划文档 `docs/active/plugin-platform-phase-3-plan.md` | — |
| 2 | 平台三层边界与服务面职责文档 | 3.1 |
| 3 | "服务 vs 命令"判定规则文档 | 3.1 |
| 4 | 插件生命周期与 contribution 规范文档 | 3.2 |
| 5 | 快捷键 keybinding 格式规范 | 3.2 |
| 6 | `ShortcutManager` 运行时实现 | 3.3 |
| 7 | `when` 条件上下文求值器 | 3.3 |
| 8 | 内置快捷键注册 | 3.3 |
| 9 | 最小插件模板 | 3.3 |
| 10 | 插件接入文档 | 3.3 |
| 11 | Command Palette 骨架 | 3.4 |
| 12 | menus / contextMenus 协议骨架 | 3.4 |
| 13 | 对应测试与接入示例 | 3.3–3.4 |

---

## 8. 风险与约束

| # | 风险 | 约束 |
|---|------|------|
| 1 | 服务面定义过宽，后续平台维护成本过高 | 只纳入跨插件复用价值明确的平台能力；新增不超过 20 行胶水代码 |
| 2 | 命令与服务边界不清，重新长出兼容层 | 新增能力必须先做归类，再决定协议落点 |
| 3 | 框架先行但没有最小样板，文档无法被验证 | 每完成一轮协议设计，都要同步补一个最小接入样例 |
| 4 | 快捷键与浏览器默认行为冲突 | 内置快捷键清单需逐一验证不与主流浏览器快捷键冲突；冲突时只在编辑器画布聚焦时拦截 |
| 5 | `inputFocused` 判定不准导致快捷键误拦截文本输入 | `inputFocused` 基于 `document.activeElement` 标签名 + contentEditable 判定；默认屏蔽非显式声明的快捷键 |
| 6 | 插件生命周期异常导致整体崩溃 | 每个插件的 activate / deactivate / dispose 独立 try-catch，不影响其他插件 |
| 7 | 贡献模型声明载体不明确，插件开发者不知如何接入 | TypeScript 类型约束 + 模板示例 + 接入文档三重保障 |

---

## 9. 完成定义（DoD）

1. 平台三层边界已形成正式文档。
2. 标准服务面和命令边界已有明确规则。
3. 插件生命周期（register / activate / deactivate / dispose）与 contribution 模型已固定。
4. **快捷键引擎已落地**，插件声明的 shortcuts 能实际触发 command 执行。
5. **内置快捷键已覆盖**基础编辑操作（undo / redo / save / copy / paste / delete）。
6. 至少一个新扩展点骨架（Command Palette）可按统一协议接入。
7. 后续 Files / Setter / AI 增强不需要再回头改平台基础协议。
8. 新插件可在 30 分钟内通过模板接入，且含快捷键声明。
