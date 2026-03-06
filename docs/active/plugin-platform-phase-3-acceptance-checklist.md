# 插件平台 Phase 3 验收清单

> 目的：明确 Phase 3 完成后“能看到什么效果”以及“如何验证”，避免只停留在协议设计层面。

---

## 1. 验收原则

1. 先验平台能力是否闭环，再验具体业务插件是否受益。
2. 每一项验收都必须同时满足：
   - 有可见效果
   - 有可执行验证方式
3. 不以“文档写完”为完成标准，必须至少有一个最小插件和一个宿主扩展点跑通。

---

## 2. 用户可见效果

### 2.1 快捷键体系可用

完成后应能看到：

1. 基础快捷键可直接工作：
   - `Mod+Z` 撤销
   - `Mod+Shift+Z` 重做
   - `Mod+S` 保存
   - `Mod+Shift+S` 另存为
2. 插件声明一个 `shortcut` 后，无需额外手写宿主接线即可触发对应命令。
3. 在输入框、文本域、`contentEditable` 区域输入时，默认不会误触发编辑器快捷键。

验证方式：

1. 手动按键验证基础快捷键。
2. 新增一个 demo 插件，声明 `command + shortcut`，验证命令可执行。
3. 聚焦输入框后再次按快捷键，验证默认不触发。

### 2.2 命令面板骨架可用

完成后应能看到：

1. `Mod+Shift+P` 打开命令面板。
2. 命令面板能列出已注册命令。
3. 命令面板能展示每条命令对应的快捷键。
4. 选中命令后能实际触发执行。

验证方式：

1. 手动打开命令面板。
2. 检查命令列表是否包含宿主命令和插件命令。
3. 选择一条命令并验证执行结果。

### 2.3 新插件接入成本可控

完成后应能看到：

1. 基于模板新增一个最小插件时，不需要阅读 `AppShell` 内部实现。
2. 新插件只通过公开协议即可接入：
   - 注册命令
   - 声明快捷键
   - 在命令面板中展示
3. 新插件可以在 30 分钟内完成接入。

验证方式：

1. 用模板创建一个 demo 插件。
2. 仅参考公开文档完成接入，不修改宿主私有逻辑。
3. 记录从创建到运行的耗时。

---

## 3. 工程侧验收

### 3.1 平台边界清晰

应满足：

1. `Host / Platform / Plugin` 三层职责有正式文档。
2. 新增能力是否进入 `PluginContext` 有准入规则。
3. `register` 被定义为宿主内部加载步骤，而不是插件钩子。
4. `deactivate` 第一阶段不因面板隐藏而触发。

验证方式：

1. 审核 [plugin-platform-phase-3-plan.md](D:/Code/lowcode/shenbi-codes/shenbi/docs/active/plugin-platform-phase-3-plan.md) 与后续边界文档。
2. 选 2-3 个新增能力候选项，验证都能明确归位。

### 3.2 快捷键协议冻结

应满足：

1. `PluginShortcutContribution` 字段固定：
   - `id`
   - `commandId`
   - `keybinding`
   - `order`
   - `priority`
   - `when`
2. `when` 初版语法固定为：
   - 变量名
   - `!变量名`
   - `&&`
3. `priority` 用于快捷键冲突决策，`order` 只用于展示排序。

验证方式：

1. 类型定义与文档一致。
2. 至少有一组快捷键冲突测试覆盖 `priority`。
3. 至少有一组 `when` 表达式测试覆盖取反和并且组合。

### 3.3 ShortcutManager 闭环

应满足：

1. 能从 `ResolvedPluginContributes.shortcuts` 构建映射表。
2. 能把 `KeyboardEvent` 规范化为 keybinding。
3. 能按 `when` 判断是否生效。
4. 能按 `priority` 解决冲突。
5. 匹配成功后能执行 `commands.execute(commandId)`。

验证方式：

1. 单元测试覆盖：
   - keybinding 解析
   - when 求值
   - priority 冲突处理
   - inputFocused 屏蔽
2. 集成测试覆盖宿主接线。

---

## 4. 测试清单

### 4.1 单元测试

至少覆盖：

1. `collectPluginContributes` 正确收集 `shortcuts`
2. `ShortcutManager` 正确解析 `Ctrl/Shift/Alt/Mod`
3. `when` 语法：
   - `editorFocused`
   - `!inputFocused`
   - `editorFocused && hasSelection`
4. 冲突决策：
   - 高 `priority` 覆盖低 `priority`
   - 同优先级时先注册者生效
5. `inputFocused` 时默认屏蔽快捷键

### 4.2 集成测试

至少覆盖：

1. `AppShell` 或宿主容器成功挂载快捷键监听
2. 插件命令可通过快捷键触发
3. 命令面板能展示命令和快捷键
4. 命令面板中执行命令可走通

### 4.3 手动冒烟

至少覆盖：

1. `Mod+Z` / `Mod+Shift+Z`
2. `Mod+S` / `Mod+Shift+S`
3. `Mod+Shift+P`
4. 输入框聚焦时快捷键不误触发
5. demo 插件的自定义快捷键可触发

---

## 5. Demo 验收场景

建议提供一个最小 demo 插件，名称可为 `demo-shortcuts-plugin`。

该插件至少包含：

1. 一个命令：`demo.shortcuts.hello`
2. 一个快捷键：`Mod+Alt+H`
3. 一条命令面板展示项
4. 执行后通过 `notifications.success` 给出反馈

完成后应能看到：

1. 插件加载后命令面板出现 `demo.shortcuts.hello`
2. 快捷键 `Mod+Alt+H` 可执行该命令
3. 不需要改宿主私有接线即可生效

---

## 6. 完成判定

Phase 3 可视为完成，至少需要同时满足：

1. 平台边界和协议文档已冻结。
2. `ShortcutManager` 已落地并通过测试。
3. 命令面板骨架可打开、可展示、可执行。
4. 至少一个 demo 插件能通过模板独立接入。
5. 快捷键、命令面板、插件模板三者形成闭环。
