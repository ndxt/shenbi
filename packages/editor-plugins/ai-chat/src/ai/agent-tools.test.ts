import { describe, expect, it } from 'vitest';
import { buildAgentLoopSystemPrompt } from './agent-tools';

describe('buildAgentLoopSystemPrompt', () => {
  it('emphasizes strict plain-text protocol and forbids common wrapper formats', () => {
    const prompt = buildAgentLoopSystemPrompt();

    expect(prompt).toContain('你的回复会被程序直接解析');
    expect(prompt).toContain('不要返回 JSON 包装对象');
    expect(prompt).toContain('不要输出 reasoning、thought、answer、type、content、output、input、params、arguments 等包装字段');
    expect(prompt).toContain('如果工具没有参数，也必须输出 Action Input: {}');
    expect(prompt).toContain('{"type":"listWorkspaceFiles"}');
    expect(prompt).toContain('{"reasoning":"...","answer":"Action: listWorkspaceFiles\\nAction Input: {}"}');
  });
});
