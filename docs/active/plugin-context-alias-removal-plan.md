# PluginContext 旧 Alias 删除清单

> 更新时间：2026-03-06

## 1. 结论

1. 宿主层与业务插件实现层已完成对 `document / selection / commands / notifications` 新服务面的切换。
2. 当前旧 alias 的真实运行时兼容，已收敛到 `packages/editor-plugins/api/src/context.ts`。
3. 可以把下一阶段目标定义为：删除 `PluginContext` 旧 alias 字段与对应 fallback，同时保留命令级兜底链路。

## 2. 当前真实调用点

### 2.1 运行时代码

1. `packages/editor-plugins/api/src/context.ts`
   兼容入口，仍保留以下 alias 读取：
   - `getSchema`
   - `replaceSchema`
   - `getSelectedNode`
   - `patchNodeProps`
   - `patchNodeColumns`
   - `patchNodeStyle`
   - `patchNodeEvents`
   - `patchNodeLogic`
   - `executeCommand`
   - `notify`

### 2.2 测试代码

1. `packages/editor-plugins/api/src/context.test.ts`
   兼容测试覆盖旧 alias fallback。

## 3. 删除清单

建议在下一阶段删除以下内容：

1. `PluginContext` 顶层字段：
   - `getSchema`
   - `replaceSchema`
   - `getSelectedNode`
   - `patchNodeProps`
   - `patchNodeColumns`
   - `patchNodeStyle`
   - `patchNodeEvents`
   - `patchNodeLogic`
   - `executeCommand`
   - `notify`
2. `packages/editor-plugins/api/src/context.ts` 中对应的 fallback 逻辑。
3. `packages/editor-plugins/api/src/context.test.ts` 中针对旧 alias 的兼容测试。

## 4. 保留项

以下能力不应在本轮删除：

1. `commands.execute('schema.replace', { schema })` 的命令级兜底。
2. `document / selection / commands / notifications` 四类正式服务面。
3. `document.patchSelectedNode.*` 的正式 patch 服务。

## 5. 迁移影响说明

1. 对 `apps/preview`：
   当前已只注入新服务面，无需迁移代码。
2. 对 `packages/editor-plugins/files|setter|ai-chat`：
   当前主实现已通过 helper 或新服务面接入，无需迁移业务逻辑。
3. 对 `packages/editor-ui`：
   当前宿主层已停止生成旧 alias，无需迁移运行时代码。
4. 对外部插件接入方：
   如果仍向 `PluginContext` 传入旧 alias，将在删除后失效，需要改为：
   - `document.getSchema`
   - `document.replaceSchema`
   - `document.patchSelectedNode.*`
   - `selection.getSelectedNode`
   - `commands.execute`
   - `notifications.*`
5. 对测试：
   需要删除兼容测试，并补充“仅新服务面可用”场景的断言。

## 6. 建议删除顺序

1. 先删除 `executeCommand`、`notify`、`getSchema`、`replaceSchema`、`getSelectedNode`。
2. 再删除 `patchNode*` 顶层 alias。
3. 最后删除 `context.ts` 中的 fallback helper 分支与兼容测试。
