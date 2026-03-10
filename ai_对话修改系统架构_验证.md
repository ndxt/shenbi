第 1 阶段：基础契约与批处理
目标：先让底层具备“AI 一轮修改 = 一次撤销”的能力。

开发项：

扩展 packages/ai-contracts/src/index.ts
增加 AgentIntent / AgentOperation / ModifyResult / FinalizeRequest
扩展 RunRequest.context.schemaJson
扩展 AgentEvent.intent / modify:start / modify:op / modify:done
改造 packages/editor-core/src/history.ts
增加 lock / commit / discard / isLocked / batchDirty
改造 packages/editor-core/src/command.ts
locked 模式下忽略 recordHistory，只要状态变更就同步 History.current
在 packages/editor-core/src/create-editor.ts 注册 history.beginBatch / commitBatch / discardBatch
验收点：

执行多条编辑命令后，只产生 1 个 undo 点
discardBatch 能恢复批处理前状态
空批次 commit 不产生 undo
node.insertAt/remove 这类 recordHistory: false 命令在批处理中也能被正确纳入一次提交
建议测试：

history.test.ts
command.test.ts
create-editor.test.ts
第 2 阶段：上下文质量
目标：让 AI 真正“看见页面”和“记住上下文”。

开发项：

新增 packages/ai-agents/src/context/schema-tree.ts
新增 packages/ai-agents/src/context/conversation-history.ts
扩展 packages/ai-agents/src/types.ts 中的 AgentRuntimeContext
给 AgentMemoryMessage.meta 增加 intent / operations / failed / sessionId
改造 packages/ai-agents/src/context/build-context.ts
前端 packages/editor-plugins/ai-chat/src/hooks/useAgentRun.ts 请求时带上 schemaJson
验收点：

请求体里能看到完整 schemaJson
trace/debug 里能看到 schema tree
历史消息能被格式化为 prompt 输入
上一轮失败记录会标记 failed: true
建议测试：

build-context 单测
schema tree 序列化单测
对话历史格式化单测
第 3 阶段：修改主链路
目标：先把“对话改页面”跑通，不要求自动识别意图。

开发项：

新增 packages/ai-agents/src/orchestrators/modify-orchestrator.ts
新增 apps/ai-api/src/runtime/modify-schema.ts
在 apps/ai-api/src/runtime/agent-runtime.ts 注册 modifySchema
新增 packages/editor-plugins/ai-chat/src/ai/operation-executor.ts
改造 packages/editor-plugins/ai-chat/src/hooks/useAgentRun.ts
modify:start -> beginBatch
modify:op -> executeSingleOperation
modify:done -> commitBatch
任一 op 失败 -> discardBatch
新增 apps/ai-api/src/routes/finalize.ts
扩展 memory store 支持 patchAssistantMessage(conversationId, sessionId, patch)
调整 packages/ai-agents/src/runtime/stream-agent.ts 为“先写 memory，再发 done”
验收点：

可以对现有页面做局部修改
页面按 modify:op 渐进更新
整轮修改只占一个 undo
失败时整轮回滚
finalize 成功时不改 memory，失败时按 sessionId patch 正确消息
建议测试：

stream-agent 单测
useAgentRun 单测
operation-executor 单测
API route 测试：/run/stream、/run/finalize
第 4 阶段：自动路由
目标：不用手工指定 create/modify/chat。

开发项：

新增 packages/ai-agents/src/orchestrators/registry.ts
新增 packages/ai-agents/src/intent/rule-classifier.ts
改造 packages/ai-agents/src/runtime/stream-agent.ts
先接规则路由
再新增 apps/ai-api/src/runtime/classify-intent.ts
最后把 LLM 分类接成高优先级、规则分类做 fallback
验收点：

“做一个 xx 页”走 schema.create
“把标题改一下”走 schema.modify
“这个组件什么意思”走 chat
follow-up 但带 create 关键词时不误判 modify
无明确意图时默认 chat
建议测试：

规则分类单测，覆盖 create / modify / follow-up / chat
编排器注册与 resolve 单测
stream-agent 路由分支单测
第 5 阶段：结构化记忆
目标：让多轮修改越来越稳。

开发项：

在 packages/ai-agents/src/runtime/stream-agent.ts 收集 intent / operations / sessionId / failed
写入 AgentMemoryMessage.meta
formatConversationHistory() 跳过或弱化失败轮次
可选增加 schemaDigest 校验，提升历史可信度
验收点：

连续多轮修改后，AI 还能引用“上一轮加的表格列”“刚才那个按钮”
失败轮次不会污染下一轮推理
memory 中能精确看到每轮做了什么
建议测试：

memory store 单测
conversation history 单测
多轮对话集成测试
建议实际排期

第 1 阶段先做完并通过单测
第 2 阶段接着做，先不碰 UI
第 3 阶段完成后，你就能第一次真实验收“对话改页面”
第 4 阶段再做自动路由
第 5 阶段最后补精度和稳定性
最关键的里程碑

里程碑 A：第 1 阶段完成
结果：批处理 undo 可用
里程碑 B：第 3 阶段完成
结果：AI 已经能局部改页面，这是最重要的业务验收点
里程碑 C：第 4、5 阶段完成
结果：体验从“能用”提升到“自然、稳定”





在这个仓库里按文档计划开始实施：
[C:/Users/zk/Code/lowcode/shenbi-codes/shenbi/ai_对话修改系统架构_plan.md](C:/Users/zk/Code/lowcode/shenbi-codes/shenbi/ai_对话修改系统架构_plan.md)

先不要泛泛做方案总结，直接开工，要求如下：

1. 先创建一个新的 git worktree 和对应分支，分支名使用 `codex/` 前缀。
2. 在新 worktree 中工作，不要污染当前目录。
3. 先通读计划文档，并结合当前代码确认 Phase 1 的实际落点。
4. 从 Phase 1 开始实现，优先做：
   - `ai-contracts` 类型扩展
   - `editor-core` 的 History batch（lock / commit / discard / isLocked / batchDirty）
   - `CommandManager` 对 locked 模式的适配
   - `create-editor` 注册 `history.beginBatch / history.commitBatch / history.discardBatch`
5. 实现时遵守现有架构，不要擅自偏离文档；如果发现文档和代码有冲突，先指出冲突并给出最小修正方案，然后继续推进。
6. 每完成一个可验证子步骤，就运行相关测试；优先补或更新对应单测。
7. 完成 Phase 1 后，汇报：
   - 实际改了哪些文件
   - 关键设计是否与文档一致
   - 跑了哪些测试，结果如何
   - 现在是否已经达到“多条操作合并为一个 undo 点”的验收标准

执行风格要求：
- 先做最小必要检查，再直接改代码
- 不要只停留在分析
- 过程中持续给出简短进度更新
- 所有文件编辑使用 `apply_patch`
- 不要回退用户已有改动

如果 Phase 1 顺利完成，再继续进入 Phase 2；但每进入下一阶段前，先明确说明“Phase 1 已验收通过，开始 Phase 2”。
如果你想让它更激进一点，也可以把最后一句改成：

Phase 1 做完并验证通过后，不要停，直接继续 Phase 2，并在每个阶段结束时做一次阶段性汇报。
我建议你在新 thread 里先用上面那版“先做 Phase 1”的提示词，更稳。