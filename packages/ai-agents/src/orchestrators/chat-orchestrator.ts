import type { AgentEvent, AgentRuntimeContext, AgentRuntimeDeps, RunMetadata, RunRequest } from '../types';

export async function* chatOrchestrator(
  request: RunRequest,
  context: AgentRuntimeContext,
  deps: AgentRuntimeDeps,
  _metadata: RunMetadata,
): AsyncGenerator<AgentEvent> {
  yield { type: 'message:start', data: { role: 'assistant' } };

  let emittedDelta = false;
  for await (const chunk of deps.llm.streamChat({
    prompt: request.prompt,
    plannerModel: request.plannerModel,
    blockModel: request.blockModel,
    context,
  })) {
    if (!chunk.text) {
      continue;
    }
    emittedDelta = true;
    yield { type: 'message:delta', data: { text: chunk.text } };
  }

  if (!emittedDelta) {
    yield { type: 'message:delta', data: { text: 'No response generated.' } };
  }
}
