# 下一步行动

> 更新时间：2026-03-06

## 1. 当前结论

1. 编辑器插件化迁移已完成主线收口。
2. `packages/editor-plugins/*` 已具备独立装配能力。
3. 当前最重要的后续工作，不是继续堆功能，而是继续缩减兼容层，准备进入稳定 API 阶段。

## 2. 下一步优先级

### P1. 继续收缩 `PluginContext` 旧 alias

状态：已完成。

目标：
1. 缩减 `getSchema / replaceSchema / getSelectedNode` 等旧字段 fallback。
2. 继续把兼容逻辑限制在 `packages/editor-plugins/api/src/context.ts`。
3. 宿主层、插件实现层不再直接生成或消费历史字段。

验收：
1. `editor-ui`、`preview`、`setter`、`ai-chat` 均只依赖新服务面：
   - `document`
   - `selection`
   - `commands`
   - `notifications`
2. `pnpm type-check`、`pnpm test` 全绿。

### P2. 评估旧 alias 删除窗口

状态：已完成，产物见 `docs/active/plugin-context-alias-removal-plan.md`。

目标：
1. 列出仍然依赖兼容字段的真实调用点。
2. 判断是否可以在下一阶段直接删除：
   - `executeCommand`
   - `notify`
   - `patchNode*`
   - `getSchema / replaceSchema / getSelectedNode`

产物：
1. 一份删除清单。
2. 一份迁移影响说明。

### P3. 进入插件能力增强阶段

状态：当前主线下一步，先做平台框架搭建，详见 `docs/active/plugin-platform-phase-3-plan.md`。

前提：
1. P1/P2 完成。
2. `PluginContext` 不再频繁变更。

候选方向：
1. Setter 深化：表达式、绑定、动作编排。
2. Files 深化：命令面板、最近文件、插件化菜单。
3. AI 深化：统一命令调用、上下文增强。

## 3. 建议执行顺序

1. 先做 P1：继续缩兼容层。
2. 再做 P2：确认删除窗口。
3. 最后再开新的插件功能面。

## 4. 不建议现在做的事

1. 不要继续扩 `PluginContext` 字段。
2. 不要把业务逻辑回流到 `editor-ui`。
3. 不要在兼容层未收稳前并行做大规模插件增强。
