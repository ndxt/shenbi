# Docs 索引

现在的阅读入口已经收口为：

1. 日常开发先看 `packages/*/README.md`
2. 只有跨包背景、路线图和历史追溯再看 `docs/`

换句话说，包级 README 现在是第一入口；`docs/` 不再承担“每个包的日常接口说明”。

## 先看这些 README

| 场景 | 先看 |
|------|------|
| Schema / 组件契约 | `packages/schema/README.md` |
| 渲染引擎 | `packages/engine/README.md` |
| 编辑器状态与命令 | `packages/editor-core/README.md` |
| 宿主壳层与桥接 | `packages/editor-ui/README.md` |
| 插件协议 | `packages/editor-plugins/api/README.md` |
| Files 插件 | `packages/editor-plugins/files/README.md` |
| Setter 插件 | `packages/editor-plugins/setter/README.md` |
| AI Chat 插件 | `packages/editor-plugins/ai-chat/README.md` |

## `docs/` 现在保留什么

### 仍然值得保留的跨包文档

| 文档 | 用途 |
|------|------|
| `docs/active/architecture-overview.md` | 引擎与系统架构背景，偏设计历史和全局视角 |
| `docs/active/architecture-contract-freeze-v1.md` | 旧的 engine/schema 冻结背景 |
| `docs/active/platform-plugin-lifecycle-and-service-freeze.md` | 插件平台生命周期与服务面冻结结论 |
| `docs/active/roadmap-next-steps.md` | 当前主线下一步工作 |
| `docs/active/schema-component-contract-spec-v1.md` | 组件契约补充规范 |
| `docs/active/process-ui-guidelines.md` | UI 规范与设计约束 |
| `docs/active/process-code-review-playbook.md` | Code Review 规范 |

### 主要作为历史参考的文档

下面这些文档仍可保留，但不应该再作为“我先看哪个”的首选入口：

- `docs/archive/history-editor-pluginization-plan.md`
- `docs/archive/history-editor-pluginization-status.md`
- `docs/archive/history-plugin-context-alias-removal-plan.md`
- `docs/archive/history-plugin-platform-phase-3-plan.md`
- `docs/archive/history-plugin-platform-phase-3-acceptance-checklist.md`
- `docs/archive/history-plugin-platform-boundaries-and-services.md`
- `docs/archive/history-plugin-platform-command-inventory.md`
- `docs/archive/history-plugin-platform-plugin-template.md`
- `docs/archive/history-plugin-platform-service-admission-template.md`
- `docs/archive/history-preview-thin-boundary-checklist.md`
- `docs/archive/history-phase-2-plan.md`
- `docs/archive/history-phase-2-parallel-delivery-playbook.md`
- `docs/archive/history-phase-2-merge-acceptance-checklist.md`
- `docs/archive/history-branch-a-contracts-catalog-guide.md`
- `docs/archive/history-branch-b-editor-setter-guide.md`
- `docs/archive/history-ai-implementation-plan.md`
- 以及其余阶段性计划、验收和 playbook 文档

这些文档仍有追溯价值，但日常开发时优先级低于包级 README。

## 是否可以删掉 `docs/`

目前不建议整批删除。

原因是 `docs/` 里还保留着两类 README 无法完全替代的信息：

1. 跨包设计背景
2. 历史阶段决策与迁移路径

但可以按下面的原则使用：

- 看接口、契约、扩展规则：优先看包级 README
- 看历史背景或为什么这样设计：再看 `docs/active`
- 已完成且长期不再维护的阶段文档：后续可以继续归档到 `docs/archive`

## 目录约定

- `docs/active/`：跨包仍有效的设计、冻结、路线图、历史参考
- `docs/archive/`：已归档的历史文档

## 维护规则

1. 包级接口说明优先写到对应 `packages/*/README.md`。
2. `docs/` 只保留跨包背景、路线图、冻结结论和历史追溯。
3. 新增文档不要再和包 README 重复描述同一份接口。
4. 已完成且不再作为当前入口的阶段性文档，可逐步移动到 `archive`。
