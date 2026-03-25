import { describe, expect, it } from 'vitest';
import type { AgentEvent } from '@shenbi/ai-contracts';
import { WorkflowEventAdapter } from './event-adapter';

describe('WorkflowEventAdapter', () => {
  it('forwards and stores events in order', () => {
    const forwarded: AgentEvent[] = [];
    const adapter = new WorkflowEventAdapter((event) => {
      forwarded.push(event);
    });

    adapter.emit({ type: 'message:start', data: { role: 'assistant' } });
    adapter.emit({ type: 'message:delta', data: { text: 'hello' } });

    expect(forwarded.map((event) => event.type)).toEqual(['message:start', 'message:delta']);
    expect(adapter.snapshot()).toEqual(forwarded);
  });
});
