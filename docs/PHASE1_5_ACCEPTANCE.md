# Shenbi Phase 1.5 验收记录（引擎 + CRUD 纵切面）

更新时间：2026-02-22  
分支：`main`

## 1. 验收命令

```bash
pnpm test && pnpm type-check
pnpm --filter @shenbi/preview test:e2e
pnpm test:phase1.5:gate
```

当前结果（2026-02-22）：

- `pnpm test && pnpm type-check`：通过
- `pnpm --filter @shenbi/preview test:e2e`：通过（`4 passed`）
- `pnpm test:phase1.5:gate`：命令已接入（`engine + preview vitest + preview e2e + perf`）

首次执行 E2E 的准备命令：

```bash
pnpm install
pnpm --filter @shenbi/preview exec playwright install
```

## 2. 引擎能力验收（Step 2 ~ Step 10）

以下能力已由 `@shenbi/engine` 自动化测试覆盖：

- 表达式与 JSFunction 编译：`packages/engine/src/compiler/expression.test.ts`
- Schema 编译（嵌套 props / columns render/editRender / loop / slots）：`packages/engine/src/compiler/schema.test.ts`
- Action 执行（fetch/validate/resetForm/confirm/modal/drawer payload 等）：`packages/engine/src/runtime/action-executor.test.ts`
- watcher/computed：`packages/engine/src/runtime/watcher.test.ts`、`packages/engine/src/runtime/computed.test.ts`
- syncToUrl：`packages/engine/src/runtime/sync-url.test.ts`、`packages/engine/src/runtime/page-runtime.test.ts`
- 渲染层（路径事件、多参数事件、Form ref、Table columns/editRender、Dialog 渲染）：`packages/engine/src/renderer/node-renderer.test.tsx`、`packages/engine/src/renderer/shenbi-page.test.tsx`

## 3. Preview 纵切面验收（Step 11）

`apps/preview/src/App.test.tsx` 当前已覆盖并稳定通过：

- 页面加载自动查询
- 关键词查询刷新
- 表格分页 onChange
- 新增弹窗打开/取消
- 行选择提示
- 状态筛选（含 URL 同步 + 列表过滤）
- 重置（回到第一页）
- syncToUrl 状态回写（keyword/page）
- syncToUrl 首次 URL 恢复（keyword/page）

数据层 CRUD 路由能力由 mock 测试覆盖：

- `apps/preview/src/mock/mock-fetch.test.ts`
- `apps/preview/src/mock/users-repo.test.ts`

## 4. 现状结论

- Phase 1.5 引擎侧核心能力已闭环，门禁通过。
- Preview 侧关键链路已有稳定集成覆盖，满足主线验收与回归。
- 新增真实浏览器 E2E 后，新增/编辑/删除/行内编辑的提交链路具备可回归测试入口。

## 5. 待补建议（不阻塞当前主线）

建议后续继续补齐以下 E2E 深化项：

- 新增/编辑表单的失败分支（校验失败、接口失败）
- 排序/分页联动的 URL 同步校验（含前进后退恢复）
- 不同视口下的关键操作可用性（窄屏/移动端）
