# Shenbi 阶段 1 验收记录

验收日期：2026-02-22  
验收分支：`main`  
验收范围：`M0`、`A1-A7`、`B1-B6`、`I1-I3`、`Q1`

## 1. 验收结论

- 结论：**通过**
- 结果：阶段 1 功能、集成、回归、性能门禁均已落地并可重复执行。

## 2. 可追溯证据

### 2.1 代码提交链路

1. `6db13c0`：合并 `feat/A-runtime`
2. `d537d6d`：合并 `feat/B-renderer`
3. `9306e34`：集成运行时全链路并更新合并后计划（I1/I2）
4. `bc68868`：修复渲染器静态 children 与 loop-if 过滤
5. `adf2ace`：新增 preview 回归测试并修复渲染细节（I3）
6. `ffd8cce`：新增性能基线脚本与测试门禁（Q1）

### 2.2 验收命令与结果

1. `pnpm test`  
结果：通过。  
要点：`@shenbi/engine` 全量测试通过（141 tests），`@shenbi/preview` 集成回归通过（4 tests）。

2. `pnpm run type-check`  
结果：通过。  
要点：`packages/schema`、`packages/engine`、`apps/preview` 全部无 TS 错误。

3. `pnpm run build`  
结果：通过。  
要点：workspace 三个项目均构建成功（preview 有 chunk size 警告，不影响构建成功）。

4. `pnpm test:gate`（`pnpm test && pnpm perf`）  
结果：通过。  
要点：常规测试 + 性能门禁联合通过。

### 2.3 性能基线（Q1）

- 基线脚本：`packages/engine/src/perf/perf-baseline.perf.ts`
- 执行命令：`pnpm --filter @shenbi/engine perf`
- 默认阈值：
  - `SHENBI_PERF_COMPILE_MS=50`
  - `SHENBI_PERF_RENDER_MS=70`
  - `SHENBI_PERF_NODE_COUNT=200`
  - `SHENBI_PERF_RUNS=25`
  - `SHENBI_PERF_WARMUPS=5`

最近一次门禁样本（2026-02-22）：

1. compile 200 nodes  
结果：`avg=4.02ms`（阈值 50ms）  
判定：通过

2. render 200 compiled nodes  
结果：`avg=22.94ms`（阈值 70ms）  
判定：通过

## 3. 任务看板映射

1. `M0-1 ~ M0-3`：完成
2. `A1 ~ A7`：完成（compiler/runtime）
3. `B1 ~ B6`：完成（resolver/renderer/preview）
4. `I1 ~ I3`：完成（导出整合、全链路接入、回归修复）
5. `Q1`：完成（性能基线脚本 + 门禁）
6. `Q2`：本文件即验收产物，完成

## 4. 后续建议（阶段 2 前置）

1. 在 CI 中执行 `pnpm test:gate` 作为合并主分支前置检查。
2. 将 `SHENBI_PERF_*` 阈值按 CI 机型做一次校准并固化到流水线变量。
