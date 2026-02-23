# Docs 索引

## 目录约定

- `docs/active/`：当前生效、可执行或持续维护的文档
- `docs/archive/`：历史阶段文档，仅供追溯

## Active

| 文档 | 用途 | 状态 |
|------|------|------|
| `docs/active/architecture-design.md` | 引擎总体架构与阶段设计基线 | 生效中 |
| `docs/active/contract-freeze-v1.md` | 核心接口冻结与变更规则 | 生效中 |
| `docs/active/component-contract-spec-v1.md` | 组件契约 v1 草案与落地建议 | 草案 |
| `docs/active/phase-2-plan.md` | 阶段 2 剩余工作计划 | 执行中 |
| `docs/active/ui-guidelines.md` | 预览端 UI 风格与实现规范 | 生效中 |
| `docs/active/code-review-playbook.md` | Code Review 流程与输出标准 | 生效中 |

## Archive

| 文档 | 用途 | 状态 |
|------|------|------|
| `docs/archive/phase-1.5-crud-design.md` | 阶段 1.5 纵切面设计与实现背景 | 归档 |

## 维护规则

1. 新增文档必须放入 `active` 或 `archive`，不要再放在 `docs/` 根目录。
2. `active` 文档如果已完成并长期不再变更，移动到 `archive`。
3. 破坏性重命名后，需同步修正文档内引用路径。
