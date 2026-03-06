# Editor 插件化重构状态（2026-03-06）

## 1. 当前状态

### 1.1 已完成

1. `editor-ui` 已接入插件贡献聚合能力（ActivityBar/Sidebar/Inspector）。
2. `packages/editor-plugins/api` 已建立并作为统一贡献类型来源。
3. 插件迁移目标已拆分为 Files / Setter / AI Chat 三条路径，并全部完成迁移闭环。
4. `packages/editor-plugins/api|files|setter|ai-chat` 已完成最小包脚手架并通过独立校验。
5. `pnpm-workspace.yaml`、根 `tsconfig.json`、`vite/vitest` alias 已同步到新目录。
6. `apps/preview` 已直接装配插件包，不再依赖 `editor-ui` 内部业务实现。
7. `editor-ui` 已收口为宿主层 + 兼容转发层，重复业务测试已移除，保留统一兼容测试。
8. 根级门禁已收口，`pnpm type-check` 与 `pnpm test` 已通过。
9. `packages/editor-plugins/files|setter|ai-chat` 已补齐 `createXxxPlugin()` 入口，可按 manifest 独立装配。
10. `AppShell` 已支持插件激活与通用辅助面板贡献，AI 不再依赖专属宿主 props 才能接入。
11. `packages/editor-plugins/*` 已切到 `dist` 产物导出，独立构建边界已建立。
12. `PluginContext` 已形成 `document / selection / commands / notifications` 四类宿主服务面，并保留兼容别名。
13. `AppShell` 已提供统一命令总线：插件命令优先执行，宿主命令作为兜底回退。
14. AI bridge 已优先走 `document.replaceSchema`，不再依赖宿主命令是否实现 `schema.replace`。
15. `apps/preview` 已移除对 `PluginContext` 旧别名字段的注入，当前三类插件均通过新服务面运行。
16. `PluginContext` 旧别名兼容已收敛到 `packages/editor-plugins/api/src/context.ts`，插件实现层不再直接感知历史字段。
17. `editor-ui/AppShell` 已停止生成 `executeCommand/notify` 等旧 alias，宿主层只分发新服务面。
18. `ai-chat` 已改为只通过 `editor-plugin-api` helper 访问 schema 替换能力，不再在插件实现层直接判断旧 alias。
19. `PluginContext` 旧 alias 删除清单与迁移影响说明已补齐到 `docs/archive/history-plugin-context-alias-removal-plan.md`。
20. `packages/editor-plugins/api` 已补充 `PluginShortcutContribution.priority` 与正式插件激活结果类型，Phase 3.2 协议冻结已形成代码基线。
21. `editor-ui/AppShell` 已接入最小 `ShortcutManager` 与 `Command Palette` 骨架，插件声明的 `shortcuts` 可直接触发命令。
22. 命令面板已支持 `category / description / aliases / keywords / recent commands`，宿主命令与插件命令可统一检索。
23. 工具栏菜单已支持 `target / group`，上下文菜单已支持 `group` 分隔，命令 surfaces 的平台模型已补齐。
24. 插件平台生命周期与服务面冻结结论已沉淀到 `docs/active/platform-plugin-lifecycle-and-service-freeze.md`。
25. 最小插件模板已落地到 `templates/editor-plugin/minimal-plugin.tsx`，插件接入说明已补齐。

### 1.2 当前结论

1. 当前主线已具备继续并行演进插件的稳定基线。
2. 后续新增能力应优先以插件形式落到 `packages/editor-plugins/*`，而不是回写到 `editor-ui`。
3. `apps/preview` 已切到插件 manifest 注册链路，业务插件可通过 `plugins` 统一装配。
4. 当前体系已具备“独立装配插件”的基本能力，但更细的服务抽象与命令分层仍可继续演进。
5. Phase 3 平台“必须做”事项已闭环，后续主要是可选增强而非基础协议补洞。

## 1.4 已完成的迁移闭环

1. Files 主实现已固定到 `packages/editor-plugins/files`。
2. `editor-ui` 中的 `FilePanel`、`useFileWorkspace` 已改为薄转发层。
3. `apps/preview` 已改为直接从 `@shenbi/editor-plugin-files` 接入 Files 能力。
4. AI Chat 主实现已固定到 `packages/editor-plugins/ai-chat`。
5. `editor-ui` 中的 `AIPanel`、`editor-ai-bridge`、`useEditorAIBridge` 已改为薄转发层。
6. `apps/preview` 已改为直接从 `@shenbi/editor-plugin-ai-chat` 接入 AI 能力。
7. Setter 主实现已固定到 `packages/editor-plugins/setter`。
8. `editor-ui` 中的 `SetterPanel`、`ActionPanel`、`inspector-tabs` 已改为薄转发层。
9. `editor-ui` 内重复的 Files / AI / Setter 测试已移除，改为统一兼容转发测试。
10. `packages/schema` 与 `packages/engine` 的既有门禁问题已顺带修复，根级验证恢复可用。
11. `apps/preview` 已切到 `pluginContext` 驱动的 AI / Setter / Files 接线，宿主 props 依赖显著减少。

## 2. 目录规范决策

### 2.1 决策

采用统一目录：

1. `packages/editor-plugins/api`
2. `packages/editor-plugins/files`
3. `packages/editor-plugins/setter`
4. `packages/editor-plugins/ai-chat`

### 2.2 约束

1. 包名保持不变（继续使用 `@shenbi/editor-plugin-api` 等），避免 import 名称震荡。
2. 仅调整 monorepo 物理目录，不在本轮做额外功能改造。
3. 迁移期间按“行为等价”执行，先迁移再优化。

### 2.3 同步项清单

1. `pnpm-workspace.yaml`：补充 `packages/editor-plugins/*`。
2. 根 `tsconfig.json` `paths`：改为新目录映射。
3. `vite/vitest` 本地 alias：改为新目录映射。
4. 插件化计划文档中的“文件边界清单”：统一为新目录。

## 3. 验证结果

1. `pnpm type-check`
2. `pnpm test`
3. `pnpm --filter @shenbi/editor-plugin-files type-check`
4. `pnpm --filter @shenbi/editor-plugin-files test`
5. `pnpm --filter @shenbi/editor-plugin-ai-chat type-check`
6. `pnpm --filter @shenbi/editor-plugin-ai-chat test`
7. `pnpm --filter @shenbi/editor-plugin-setter type-check`
8. `pnpm --filter @shenbi/editor-plugin-setter test`
9. `pnpm --filter @shenbi/editor-ui type-check`
10. `pnpm --filter @shenbi/editor-ui test`
11. `pnpm --filter @shenbi/preview type-check`
12. `pnpm --filter @shenbi/preview test`

## 4. 后续约束

1. `editor-ui` 只继续承载壳层、扩展点容器、统一 UI 规范与兼容导出。
2. Files / Setter / AI Chat 的后续演进应直接落到各自插件包。
3. 若新增文件面板、AI 面板、Setter 面板等同类能力，优先新增插件包，不回流到宿主层。
