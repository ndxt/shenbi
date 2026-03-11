import { describe, expect, it, vi } from 'vitest';
import { createOrchestratorRegistry } from './registry';
import type { AgentRuntimeContext, AgentRuntimeDeps } from '../types';
import { createInMemoryAgentMemoryStore } from '../memory/memory-store';
import { createToolRegistry } from '../tools/registry';

function createContext(overrides: Partial<AgentRuntimeContext> = {}): AgentRuntimeContext {
  return {
    prompt: '修改当前卡片标题',
    selectedNodeId: 'card-1',
    document: {
      exists: true,
      summary: 'pageId=page-1',
    },
    componentSummary: 'Card',
    conversation: {
      history: [],
      turnCount: 0,
    },
    lastBlockIds: [],
    ...overrides,
  };
}

function createDeps(): AgentRuntimeDeps {
  return {
    llm: {
      chat: vi.fn(async () => ({ text: 'unused' })),
      streamChat: vi.fn(async function* () {
        yield { text: 'unused' };
      }),
    },
    tools: createToolRegistry([]),
    memory: createInMemoryAgentMemoryStore(),
  };
}

describe('createOrchestratorRegistry', () => {
  it('resolves the first handler that can handle the requested intent', () => {
    const registry = createOrchestratorRegistry();
    const fallback = vi.fn(async function* () {});
    const targeted = vi.fn(async function* () {});

    registry.register({
      id: 'fallback',
      intents: ['schema.modify'],
      canHandle: () => false,
      orchestrate: fallback,
    });
    registry.register({
      id: 'targeted',
      intents: ['schema.modify'],
      canHandle: () => true,
      orchestrate: targeted,
    });

    expect(registry.resolve('schema.modify', createContext(), createDeps())).toBe(targeted);
  });
});
