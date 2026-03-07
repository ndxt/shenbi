import { EventWriter } from './event-writer';
import { runAgentStream } from './stream-agent';
import type { AgentEvent, AgentRuntimeDeps, RunRequest } from '../types';

export async function runAgent(
  request: RunRequest,
  deps: AgentRuntimeDeps,
): Promise<AgentEvent[]> {
  const writer = new EventWriter();
  for await (const event of runAgentStream(request, deps)) {
    writer.push(event);
  }
  return writer.toArray();
}
