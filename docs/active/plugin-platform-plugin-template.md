# 最小插件模板接入说明

> 对应模板文件：`templates/editor-plugin/minimal-plugin.tsx`

## 1. 目的

用一份最小可运行模板验证三件事：

1. 新插件只靠 `defineEditorPlugin` 就能接入。
2. `command + shortcut + menu + contextMenu` 可以走统一协议。
3. 插件作者不需要翻宿主实现猜测扩展点规则。

## 2. 模板包含的能力

1. 一个最小命令
2. 一个快捷键声明
3. 一个工具栏菜单声明
4. 一个画布上下文菜单声明
5. 一个简单的 `activate` 清理函数示例

## 3. 接入步骤

1. 复制 `templates/editor-plugin/minimal-plugin.tsx`
2. 修改插件 `id / name`
3. 修改命令 ID 前缀，保持 `{pluginId}.{action}` 格式
4. 按需增删 `menus / contextMenus / shortcuts`
5. 在宿主或预览端把 manifest 加入 `plugins` 列表

## 4. 接入约束

1. 不要直接监听全局键盘事件。
2. 不要直接依赖宿主私有组件或状态。
3. 不要把未评审的新能力直接塞进 `PluginContext`。
4. 可触发动作优先声明为 `commands`，再通过菜单或快捷键复用。

## 5. 推荐扩展顺序

1. 先加命令
2. 再加快捷键
3. 再接菜单或上下文菜单
4. 最后再考虑新增服务面需求
