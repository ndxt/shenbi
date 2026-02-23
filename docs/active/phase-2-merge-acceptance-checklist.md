# 神笔阶段2合并验收清单（A/B并行）

> 适用于分支：
> - A：`feat/contracts-catalog-phase2`
> - B：`feat/editor-setter-phase2`

---

## 1. 使用方式

1. 分支负责人按本模板提交“自检结果”。
2. Main 维护者按“主线复核清单”逐条确认。
3. 未满足项必须先修复，再进入下一步合并。

---

## 2. A 分支回报模板（Contracts）

### 2.1 变更摘要
- 本次新增/更新契约文件：
- 新增/更新组件数量：
- 是否包含 breaking change（是/否）：

### 2.2 文件边界自检
- 仅修改了以下路径：
- 未修改 `packages/engine/**`（是/否）：
- 未修改 `apps/preview/src/ui/**`（是/否）：

### 2.3 命令结果
- `pnpm --filter @shenbi/schema type-check`：
- `pnpm --filter @shenbi/preview type-check`：

### 2.4 契约质量检查
- `componentType` 是否唯一（是/否）：
- `contracts/index.ts` 是否已同步导出与注册（是/否）：
- skip 清单（如有）：

### 2.5 风险与待办
- 已知风险：
- 下一步计划：

---

## 3. B 分支回报模板（Editor Setter）

### 3.1 变更摘要
- 本次新增 UI 模块：
- 对接接口（props/events）清单：
- 仍为占位的功能点：

### 3.2 文件边界自检
- 仅修改了以下路径：
- 未修改 `packages/engine/**`（是/否）：
- 未修改 `packages/schema/contracts/**`（是/否）：

### 3.3 命令结果
- `pnpm --filter @shenbi/preview type-check`：
- `pnpm --filter @shenbi/preview test`：

### 3.4 UI 验收截图/录屏
- 深色主题：
- 浅色主题：
- 关键交互（组件栏/组件树/Setter）：

### 3.5 风险与待办
- 已知风险：
- 下一步计划：

---

## 4. Main 复核清单（合并前）

### 4.1 合并顺序
1. 先 A 后 B（必须）。
2. A 合入后先跑一次主线门禁，再合 B。

### 4.2 主线命令门禁
1. `pnpm --filter @shenbi/schema type-check`
2. `pnpm --filter @shenbi/preview type-check`
3. `pnpm --filter @shenbi/preview test`

### 4.3 冲突与接口检查
- B 是否仅通过 `contracts/index.ts` 消费契约（是/否）：
- `ComponentContract` v1 字段是否保持兼容（是/否）：
- 是否出现跨边界改动（是/否）：

### 4.4 回归风险记录
- 合并后新增风险：
- 建议补测项：

---

## 5. 合并结论模板

### 5.1 A 分支结论
- 结论：`可合并 / 修复后可合并 / 阻断合并`
- 备注：

### 5.2 B 分支结论
- 结论：`可合并 / 修复后可合并 / 阻断合并`
- 备注：

### 5.3 主线最终结论
- 结论：`可合并 / 修复后可合并 / 阻断合并`
- 执行人：
- 日期：

