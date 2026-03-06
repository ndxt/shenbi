# `@shenbi/engine`

`@shenbi/engine` 负责把 `PageSchema` 编译、运行并渲染成 React 页面。它是纯引擎层，不应该承载编辑器宿主逻辑或插件逻辑。

## 这个包负责什么

- 编译层：
  - 表达式编译
  - Schema 预编译
- 运行时：
  - 页面状态
  - 动作执行
  - watcher / datasource / computed
- 渲染层：
  - `ShenbiPage`
  - `NodeRenderer`
  - `ComponentResolver`
- Resolver：
  - `antdResolver(...)`
  - 自定义组件注册与解析

## 对外入口

- 主入口：`src/index.ts`
- 冻结类型入口：`src/types/contracts.ts`
- mocks 入口：`src/__mocks__/index.ts`

## 当前冻结的跨包契约

以下类型是当前稳定基线：

- `CompiledExpression`
- `CompiledColumn`
- `CompiledLoop`
- `CompiledNode`
- `StateAction`
- `PageRuntime`
- `ComponentResolver`

这些类型由：

- `packages/engine/src/types/contracts.ts`
- `packages/schema/types/index.ts`

共同构成跨包 source of truth。

## 边界

`engine` 只依赖 `@shenbi/schema`，不应反向依赖：

- `editor-core`
- `editor-ui`
- `editor-plugins/*`
- `apps/preview`

如果某个能力只在编辑器里成立，不应放进这个包。

## 变更规则

1. 公开类型优先做增量扩展，不做破坏性重命名。
2. 改 `PageRuntime`、`CompiledNode`、`ComponentResolver` 这类跨层接口时，必须同步更新：
   - 本 README
   - `packages/schema/README.md`
   - `docs/README.md`
3. UI 组件库适配优先走 resolver，不要把 antd 业务语义直接写死到编译或运行时。

## 后续新增功能时的判断

- 如果是 Schema 到页面的通用能力，放这里。
- 如果是编辑器命令、历史、文件持久化，不放这里，去 `editor-core`。
- 如果是宿主面板、插件扩展点、快捷键、命令面板，不放这里，去 `editor-ui`。

## 参考

- 架构背景：[`docs/active/architecture-overview.md`](../../docs/active/architecture-overview.md)
- 旧的冻结说明：[`docs/active/architecture-contract-freeze-v1.md`](../../docs/active/architecture-contract-freeze-v1.md)
