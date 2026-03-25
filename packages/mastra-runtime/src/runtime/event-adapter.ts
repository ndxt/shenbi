import type { AgentEvent } from '@shenbi/ai-contracts';

export type AgentEventSink = (event: AgentEvent) => void;

export class WorkflowEventAdapter {
  private readonly events: AgentEvent[] = [];

  constructor(private readonly sink: AgentEventSink) {}

  emit(event: AgentEvent): void {
    this.events.push(event);
    this.sink(event);
  }

  snapshot(): AgentEvent[] {
    return [...this.events];
  }
}
