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
| `docs/active/editor-pluginization-plan.md` | Editor 插件化重构计划、并行分支边界与验收门禁 | 执行中 |
| `docs/active/editor-pluginization-status.md` | Editor 插件化当前进度、目录决策与同步清单 | 执行中 |
| `docs/active/next-steps.md` | 当前主线下一步行动、优先级与非目标 | 执行中 |
| `docs/active/plugin-context-alias-removal-plan.md` | `PluginContext` 旧 alias 删除清单与迁移影响说明 | 执行中 |
| `docs/active/plugin-platform-phase-3-plan.md` | 插件平台 Phase 3 框架搭建计划与里程碑 | 执行中 |
| `docs/active/plugin-platform-phase-3-acceptance-checklist.md` | 插件平台 Phase 3 可见效果、验证方式与验收清单 | 执行中 |
| `docs/active/plugin-platform-boundaries-and-services.md` | Phase 3.1 平台边界、服务面与命令归位设计 | 执行中 |
| `docs/active/plugin-platform-command-inventory.md` | Phase 3.1 现有命令归类与后续目标命令清单 | 执行中 |
| `docs/active/plugin-platform-service-admission-template.md` | Phase 3.1 新增服务面准入评审模板 | 执行中 |
| `docs/active/plugin-platform-lifecycle-service-freeze.md` | Phase 3 生命周期、稳定服务面与候选服务面冻结结论 | 生效中 |
| `docs/active/plugin-platform-plugin-template.md` | 最小插件模板说明与接入步骤 | 生效中 |
| `docs/active/phase-2-parallel-delivery-playbook.md` | 并行分支交付边界、接口冻结与合并门禁 | 执行中 |
| `docs/active/phase-2-merge-acceptance-checklist.md` | A/B 分支合并验收模板与主线复核清单 | 执行中 |
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
