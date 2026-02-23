# UI 分支大模型提示文档

## 适用分支

- 分支：`feat/preview-ui-phase15`
- 工作目录：`C:\Users\zk\Code\lowcode\shenbi-codes\shenbi-ui`

## 提示依据（按优先级）

1. `docs/UI.md`
2. `docs/worktree-boundary-ui.md`
3. `apps/preview/src/features/crud/public-api.ts`

## 可直接投喂的大模型提示词

```text
你在分支 feat/preview-ui-phase15 工作，只做 apps/preview 的界面优化，不做功能逻辑改动。

必须遵循：
1) docs/UI.md（主 UI 规范）
2) docs/worktree-boundary-ui.md（文件边界）
3) apps/preview/src/features/crud/public-api.ts（只读契约）

硬约束：
- 只允许修改：
  apps/preview/src/ui/**
  apps/preview/src/layout/**
  apps/preview/src/panels/**
  apps/preview/src/theme/**
  apps/preview/src/styles/**
  apps/preview/src/App.tsx
  apps/preview/src/main.tsx
- 禁止修改：
  packages/engine/src/**
  apps/preview/src/mock/**
  apps/preview/src/features/crud/**
  apps/preview/src/schemas/user-management.ts
  docs/shenbi-phase-1.5-design-doc.md

目标：
- 先实现 IDE 风格 UI Shell（Activity Bar / Sidebar / Workbench Toolbar / Right Inspector / Status Bar / Bottom Console）的静态与交互骨架
- 风格严格按 docs/UI.md（暗色、高密度、边界分层、VS Code 风格）
- 不改变业务语义，业务数据仅通过 public-api 消费
- 输出必须包含：改动文件列表、关键设计点、测试结果
```
