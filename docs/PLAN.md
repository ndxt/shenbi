# Shenbi 阶段 1 任务看板

状态说明：`TODO` 未开始，`BLOCKED` 依赖未满足，`READY` 可立即开工，`DONE` 已完成。  
负责人默认：`A`（编译/运行时）、`B`（渲染/预览）、`AB`（联合）。

| ID | 任务 | 主要文件 | 负责人 | 依赖 | 预估 | 状态 | 验收标准 |
|---|---|---|---|---|---|---|---|
| M0-1 | 基线检查（workspace/test 命令） | `pnpm-workspace.yaml` `package.json` `tsconfig*.json` | AB | 无 | 0.5h | DONE | 安装与测试命令可执行（安装后） |
| M0-2 | 冻结接口契约文档 | `docs/DESIGN.md`（提炼） `packages/engine/src/types/*`（若有） | AB | M0-1 | 1h | DONE | `CompiledNode/PageRuntime/ComponentResolver` 字段不再变动 |
| M0-3 | 产出 mock 契约样例 | `packages/engine/src/__mocks__/compiled-node.ts` `runtime.ts` | AB | M0-2 | 1h | DONE | A/B 可独立联调 mock |
| A1 | 表达式编译器 | `packages/engine/src/compiler/expression.ts` `expression.test.ts` | A | M0-2 | 4h | TODO/READY | `{{}}` 编译、deps 提取、异常处理测试通过 |
| A2 | Schema 编译器 | `packages/engine/src/compiler/schema.ts` `schema.test.ts` | A | A1 | 5h | TODO/READY | `SchemaNode -> CompiledNode` 完整转换 |
| A3 | State 管理 | `packages/engine/src/runtime/state.ts` `state.test.ts` | A | M0-2 | 4h | TODO/READY | `SET/MERGE/RESET` 与路径写入通过 |
| A4 | Computed 管理 | `packages/engine/src/runtime/computed.ts` `computed.test.ts` | A | A3 | 3h | TODO/READY | deps 缓存与重算正确 |
| A5 | Action 执行器（MVP action） | `packages/engine/src/runtime/action-executor.ts` `action-executor.test.ts` | A | A1 A3 | 8h | TODO/READY | `setState/callMethod/fetch/condition/loop/batch` 等核心动作通过 |
| A6 | Watcher 管理器 | `packages/engine/src/runtime/watcher.ts` `watcher.test.ts` | A | A3 A5 | 4h | TODO/READY | `immediate/debounce/throttle/deep` 行为正确 |
| A7 | DataSource 管理器 | `packages/engine/src/runtime/datasource.ts` `datasource.test.ts` | A | A1 A5 | 5h | TODO/READY | `auto/deps/transform/loading/error` 通过 |
| B1 | Resolver 工厂与 antd 注册 | `packages/engine/src/resolver/index.ts` `index.test.ts` | B | M0-2 | 4h | TODO/READY | 普通组件、`Form.Item`、未知组件行为符合设计 |
| B2 | NodeRenderer 核心 13 步流程 | `packages/engine/src/renderer/node-renderer.tsx` `node-renderer.test.tsx` | B | B1 M0-3 | 10h | TODO/READY | 条件、循环、事件、slots、columns 测试通过 |
| B3 | ShenbiPage 入口 | `packages/engine/src/renderer/shenbi-page.tsx` | B | B2 A3 | 4h | TODO/READY | runtime/context/compile 接入完成 |
| B4 | builtins 内置组件 | `packages/engine/src/renderer/builtins/*` | B | B2 | 3h | TODO/READY | `Container/PageEmbed/__fragment/__ref` 可用 |
| B5 | Preview 应用壳 | `apps/preview/src/*` | B | B3 | 4h | TODO/READY | Vite 启动并渲染页面 |
| B6 | Demo Schema 6 场景 | `apps/preview/src/schemas/demo.json` | B | B5 | 3h | TODO/READY | Button/Input/Select/Card/Tag-loop/Alert-if 可交互 |
| I1 | 引擎导出整合 | `packages/engine/src/index.ts` `package.json` | AB | A1-7 B1-4 | 2h | TODO/BLOCKED | 对外 API 稳定可引用 |
| I2 | Preview 接入真实全链路 | `apps/preview/src/*` | AB | I1 B6 | 4h | TODO/BLOCKED | 编译+运行时+渲染联通 |
| I3 | 集成回归修复 | 相关改动文件 | AB | I2 | 6h | TODO/BLOCKED | 文档列出的全流程回归通过 |
| Q1 | 性能与门禁 | `packages/engine/*test*` `apps/preview` | AB | I3 | 3h | TODO/BLOCKED | 200 节点编译 <50ms、渲染流畅 |
| Q2 | 阶段1验收记录 | `docs/` 下验收文档 | AB | Q1 | 1h | TODO/BLOCKED | 验收项逐条勾选可追溯 |

## 建议执行顺序（开工序）

1. `M0-1 -> M0-2 -> M0-3`
2. 并行：`A1~A7` 与 `B1~B6`
3. 串行：`I1 -> I2 -> I3 -> Q1 -> Q2`
