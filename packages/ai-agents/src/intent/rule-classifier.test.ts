import { describe, expect, it } from 'vitest';
import { classifyIntentByRules } from './rule-classifier';
import type { AgentRuntimeContext } from '../types';

function createContext(overrides: Partial<AgentRuntimeContext> = {}): AgentRuntimeContext {
  return {
    prompt: '请帮我看看这个页面',
    document: {
      exists: true,
      summary: 'pageId=page-1; nodeCount=3',
    },
    componentSummary: 'Card, Table',
    conversation: {
      history: [],
      turnCount: 0,
    },
    lastBlockIds: [],
    ...overrides,
  };
}

describe('classifyIntentByRules', () => {
  it('prefers create keywords over selected-node modify signals', () => {
    expect(classifyIntentByRules(createContext({
      prompt: '再生成一个订单页',
      selectedNodeId: 'card-1',
    }))).toEqual({ intent: 'schema.create', confidence: 0.85 });
  });

  it('routes explicit modify prompts to schema.modify', () => {
    expect(classifyIntentByRules(createContext({
      prompt: '把当前卡片标题改成活跃用户',
      selectedNodeId: 'card-1',
    }))).toEqual({ intent: 'schema.modify', confidence: 0.9 });
  });

  it('uses chat as the default when no other signal is present', () => {
    expect(classifyIntentByRules(createContext())).toEqual({ intent: 'chat', confidence: 0.4 });
  });
});
