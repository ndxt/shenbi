import type { AgentEvent } from '../types';

export class EventWriter {
  private readonly events: AgentEvent[] = [];

  push(event: AgentEvent): void {
    this.events.push(event);
  }

  toArray(): AgentEvent[] {
    return [...this.events];
  }
}
