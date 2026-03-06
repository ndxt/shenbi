# `packages/editor-plugins`

这里存放编辑器插件平台的协议包和具体业务插件包。

## 子工程说明

- `api`
  - 唯一插件协议来源
  - 定义 `PluginContext`、manifest、contributions、快捷键与命令贡献类型
- `files`
  - 文件面板与文件工作流插件
- `setter`
  - 属性面板与 inspector tabs 插件
- `ai-chat`
  - AI 辅助面板与编辑器 AI bridge 插件

## 当前目录规则

1. 新的业务插件优先新增到这里，不回写到 `editor-ui`。
2. 所有插件都必须基于 `@shenbi/editor-plugin-api` 定义 manifest。
3. 不允许每个插件自己发明一套宿主协议。

## 阅读顺序

1. 先看 [`api/README.md`](./api/README.md)
2. 再看具体插件包 README
3. 最后再看 `docs/README.md` 里的跨包背景文档
