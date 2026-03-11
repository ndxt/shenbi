# AI Modify 测试指南

本文档用于验证当前 AI modify 链路是否满足以下目标：

- 多条 AI 修改操作合并为 1 个 undo 点
- modify 失败时整批回滚
- `finalize` 会回写 memory，并生成 memory dump
- UI 能正确显示 `Trace File` / `Debug File` / `Memory Dump`
- 调试产物能在本地目录中定位

## 1. 自动化测试

在仓库根目录执行：

```powershell
pnpm --filter @shenbi/editor-core test
pnpm --filter @shenbi/ai-agents test
pnpm --filter @shenbi/ai-api exec vitest run src/runtime/agent-runtime.test.ts -t "agent runtime finalize"
pnpm --filter @shenbi/ai-api exec vitest run src/test/app.test.ts
pnpm --filter @shenbi/editor-plugin-ai-chat exec vitest run src/hooks/useAgentRun.test.tsx src/ui/AIPanel.test.tsx src/ui/AIPanel.integration.test.tsx
pnpm --filter @shenbi/editor-plugin-ai-chat type-check
pnpm --filter @shenbi/ai-api type-check
```

### 通过标准

- `editor-core` 测试通过：说明 history batch 和 undo/redo 基础能力正常
- `useAgentRun` 测试通过：说明 modify 执行、失败回滚、finalize 回写正常
- `AIPanel.integration.test.tsx` 通过：说明 `AIPanel -> fetch stream -> finalize -> editor` 链路正常
- `agent runtime finalize` 测试通过：说明 memory dump、失败 patch、`schemaDigest` 回写正常

### 注意

不要把 `apps/ai-api/src/runtime/agent-runtime.test.ts` 全量作为验收基线。仓库里仍有历史 `.ai-debug/traces/*.json` 样本缺失问题，所以当前只跑 `finalize` 相关定向 case。

## 2. 手工联调前提

要做真实联调，需要满足：

- 根目录 `.env` 或 `.env.local` 已配置可用的 AI provider
- `ai-api` 和 `preview` 同时启动

启动命令：

终端 1：

```powershell
pnpm --filter @shenbi/ai-api dev
```

终端 2：

```powershell
pnpm --filter @shenbi/preview dev
```

说明：

- `preview` 会把 `/api` 代理到 `http://localhost:3100`
- `ai-api` 默认监听 `3100`

## 3. 手工联调用例

### 用例 A：成功 modify

步骤：

1. 打开 `preview`
2. 在页面中选中一个已有 `Card`
3. 在右侧 AI 面板输入：

```text
把当前卡片标题改成新标题，并追加一段说明
```

4. 点击发送

预期结果：

- 卡片标题被更新
- 卡片下新增一段文本
- 面板底部显示：
  - `Trace File: .ai-debug/traces/...`
  - `Memory Dump: .ai-debug/memory/...`
- 这轮 AI 修改只产生 1 个 undo 点

继续验证：

1. 点击一次撤销

预期结果：

- 标题恢复为原值
- 新增说明整体消失
- 不是一条一条撤，而是整批回退

### 用例 B：失败回滚

步骤：

1. 保持选中一个节点
2. 输入一条容易导致 modify 失败的指令，例如让 AI 删除一个并不存在的节点

预期结果：

- 面板提示 modify 失败
- 页面不留下半成品
- 如果是 modify 流失败，应执行整批回滚
- 底部仍能看到 debug 路径

### 用例 C：调试产物验证

执行成功或失败后，检查以下目录：

- `.ai-debug/traces`
- `.ai-debug/memory`

预期结果：

- `traces` 中可以找到本轮运行对应的 trace 文件
- `memory` 中可以找到 `finalize` 对应的 memory dump
- 成功时 dump 中应带有 `schemaDigest`
- 失败时 dump 中应带有 `failed: true`
- 失败时原 `operations` 应被清掉

## 4. 关键验收点

本轮 AI modify 能力是否可接受，重点看以下 5 项：

1. 一轮 AI 多步修改，只产生 1 个 undo 点
2. modify 失败会整批回滚
3. `finalize` 后会生成 memory dump
4. UI 能区分显示 `Trace File` 和 `Debug File`
5. 缺失 `durationMs` / `tokensUsed` 时，不显示 `undefined`

## 5. 当前调试文件位置

工作目录：

```text
C:\Users\zk\Code\lowcode\shenbi-codes\shenbi-codex-phase1
```

调试目录：

```text
C:\Users\zk\Code\lowcode\shenbi-codes\shenbi-codex-phase1\.ai-debug\traces
C:\Users\zk\Code\lowcode\shenbi-codes\shenbi-codex-phase1\.ai-debug\memory
```
