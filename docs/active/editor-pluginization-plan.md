# Editor 插件化重构计划（Phase 2）

> 目标：`editor-ui` 回归宿主壳层；Files / Setter / AI 等能力插件化，支持并行开发与独立演进。

---

## 1. 目标与边界

### 1.1 目标

1. `packages/editor-ui` 只承载 UI 规范、布局、交互协议与扩展点容器。
2. 新增统一插件 API，面板能力通过插件贡献，不再内聚在 `editor-ui`。
3. 迁移过程保持行为等价，优先“可回归、可合并、可回滚”。

### 1.2 非目标（本轮不做）

1. 不重做渲染引擎。
2. 不在本轮实现复杂 AI 编排能力。
3. 不进行跨包大规模重命名（仅限必要迁移）。

---

## 2. 目标架构

1. Host：`packages/editor-ui`
2. API：`packages/editor-plugins/api`
3. Plugins：
   1. `packages/editor-plugins/files`
   2. `packages/editor-plugins/setter`
   3. `packages/editor-plugins/ai-chat`
4. 装配层：`apps/preview` 负责插件注册与组合。

说明：
1. 包名保持不变（继续使用 `@shenbi/editor-plugin-api` 等），仅调整物理目录。

---

## 3. 分阶段计划

### Phase 0：基线冻结（0.5 天）

产物：
1. 当前功能清单与迁移映射表。
2. 回归命令基线（type-check / test / 冒烟）。

验收：
1. 现有主流程不回退。
2. 基线命令全绿。

### Phase 1：插件 API v1（1 天）

产物：
1. `packages/editor-plugins/api`。
2. `PluginManifest / PluginContext / contributes` 类型定义。
3. 空插件示例与接入文档。

验收：
1. Host 可加载空插件并渲染贡献点。
2. API 文档可指导新增一个最小插件。

### Phase 2：Files 插件迁移（1 天）

产物：
1. `editor-plugin-files`（含文件面板、快捷键、dirty 守卫）。
2. `editor-ui` 去业务化：仅保留面板容器与扩展接入。

验收：
1. 文件列表/打开/保存/另存行为等价。
2. 快捷键与离开页面保护行为等价。

### Phase 3：Setter 插件迁移（1.5~2 天）

产物：
1. `editor-plugin-setter`（契约驱动字段渲染 + patch）。
2. Inspector 只保留容器与 tab 协议。

验收：
1. Props/Style/Events/Logic 的核心回写路径等价。
2. Table/Form.Item 等关键专用能力不回退。

### Phase 4：AI Chat 插件迁移（1 天）

产物：
1. `editor-plugin-ai-chat`（消息面板 + bridge 接入）。
2. Host 不再持有 AI 业务细节。

验收：
1. AI 面板打开、消息链路、上下文同步可用。
2. 无跨插件全局状态污染。

### Phase 5：收口与硬化（0.5~1 天）

产物：
1. 清理 `editor-ui` 业务残留。
2. 文档与测试矩阵更新。

验收：
1. 新架构下 type-check/test 全绿。
2. 回归清单通过并可形成 PR 验收记录。

---

## 4. Git Worktree / 分支规划

1. `feature/plugin-api-v1`
2. `feature/plugin-files-migration`
3. `feature/plugin-setter-migration`
4. `feature/plugin-ai-chat-migration`
5. `feature/plugin-integration-hardening`

建议 worktree 根目录：
1. `shenbi-worktrees/editor-plugin-api`
2. `shenbi-worktrees/editor-plugin-files`
3. `shenbi-worktrees/editor-plugin-setter`
4. `shenbi-worktrees/editor-plugin-ai-chat`
5. `shenbi-worktrees/editor-plugin-integration`

---

## 5. 并行开发策略

### 5.1 可并行

1. `plugin-files-migration`
2. `plugin-setter-migration`
3. `plugin-ai-chat-migration`

前提：`plugin-api-v1` 先冻结 v1 接口。

### 5.2 合并顺序（强约束）

1. 先 `plugin-api-v1`
2. 再按风险低到高：`plugin-files` -> `plugin-ai-chat` -> `plugin-setter`
3. 最后 `plugin-integration-hardening`

---

## 6. 分支文件边界清单（必须遵守）

### 6.1 `feature/plugin-api-v1`

允许：
1. `packages/editor-plugins/api/**`
2. `packages/editor-ui/src/**`（仅扩展点与宿主适配）
3. `docs/active/editor-pluginization-plan.md`（必要更新）

禁止：
1. `packages/editor-plugins/files/**`
2. `packages/editor-plugins/setter/**`
3. `packages/editor-plugins/ai-chat/**`

### 6.2 `feature/plugin-files-migration`

允许：
1. `packages/editor-plugins/files/**`
2. `packages/editor-ui/src/**`（仅 files 接入适配）
3. `apps/preview/src/**`（仅插件注册）

禁止：
1. `packages/editor-plugins/api/**`（除修复类型错误外）
2. `packages/editor-plugins/setter/**`
3. `packages/editor-plugins/ai-chat/**`

### 6.3 `feature/plugin-setter-migration`

允许：
1. `packages/editor-plugins/setter/**`
2. `packages/editor-ui/src/**`（仅 inspector/setter 接入适配）
3. `apps/preview/src/**`（仅插件注册）

禁止：
1. `packages/editor-plugins/files/**`
2. `packages/editor-plugins/ai-chat/**`
3. `packages/engine/**`（除明确 blocker 修复）

### 6.4 `feature/plugin-ai-chat-migration`

允许：
1. `packages/editor-plugins/ai-chat/**`
2. `packages/editor-ui/src/**`（仅 AI panel 接入适配）
3. `apps/preview/src/**`（仅插件注册）

禁止：
1. `packages/editor-plugins/files/**`
2. `packages/editor-plugins/setter/**`
3. `packages/engine/**`（除明确 blocker 修复）

### 6.5 `feature/plugin-integration-hardening`

允许：
1. `packages/editor-ui/**`
2. `packages/editor-plugins/api/**`
3. `packages/editor-plugins/files/**`
4. `packages/editor-plugins/setter/**`
5. `packages/editor-plugins/ai-chat/**`
6. `apps/preview/**`
7. `docs/active/**`

禁止：
1. 超出插件化收口范围的需求新增。

---

## 7. 每分支统一验收清单

1. `pnpm type-check`
2. `pnpm test`
3. `pnpm --filter @shenbi/preview test`
4. 手动冒烟：
   1. 模式切换（Preview/Shell）
   2. 侧栏 tab 切换
   3. Inspector 面板可交互
   4. 文件/Setter/AI 对应主流程可走通（按分支范围）

---

## 8. 风险与预案

1. 风险：插件 API 频繁变更导致三条迁移分支反复返工。  
预案：API v1 冻结后只允许增量字段，不允许破坏式重命名。

2. 风险：迁移中 Host 仍保留旧逻辑，出现双路执行。  
预案：每阶段完成后立刻删除旧路径并补回归测试。

3. 风险：Setter 插件耦合契约细节，升级成本高。  
预案：契约访问统一走 `@shenbi/schema` 公开 API，不直连内部文件。

---

## 9. 完成定义（DoD）

1. `editor-ui` 不再包含 Files / Setter / AI 业务实现。
2. 三类能力均以插件形式注册并可独立测试。
3. 新增插件可按文档在 1 小时内接入一个最小面板。
4. 主分支门禁（type-check/test/冒烟）持续稳定通过。
