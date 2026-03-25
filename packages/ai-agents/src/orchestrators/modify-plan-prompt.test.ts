import { describe, expect, it } from 'vitest';
import { buildModifyPlanPromptSpec } from './modify-plan-prompt';

describe('modify-plan-prompt', () => {
  it('builds planner prompt text with focused-node and history context', () => {
    const prompt = buildModifyPlanPromptSpec({
      prompt: '把时间线往左挪一点',
      schemaSummary: '用户详情页',
      focusedNodeContext: 'Focused node: Timeline#timeline-1',
      documentTree: 'Card#detail-card > Timeline#timeline-1',
      conversationHistory: 'user: 调整详情页布局',
      lastSuccessfulOperationsSummary: '1. 修改了标题',
      lastSuccessfulOperationsRawJson: '[{"op":"schema.patchProps","nodeId":"card-1"}]',
    });

    expect(prompt.systemText).toContain('schema.patchStyle');
    expect(prompt.systemText).toContain('--ant-timeline-item-label-width');
    expect(prompt.userLines).toEqual([
      'Prompt: 把时间线往左挪一点',
      'Schema Summary: 用户详情页',
      'Focused Node Context:',
      'Focused node: Timeline#timeline-1',
      'Schema Tree:',
      'Card#detail-card > Timeline#timeline-1',
      'Conversation History:',
      'user: 调整详情页布局',
      'Last Successful Operations Summary:',
      '1. 修改了标题',
      'Last Successful Operations Raw JSON (secondary reference):',
      '[{"op":"schema.patchProps","nodeId":"card-1"}]',
    ]);
  });

  it('falls back to schema-tree unavailable when document tree is missing', () => {
    const prompt = buildModifyPlanPromptSpec({
      prompt: '加一个按钮',
      schemaSummary: '列表页',
      conversationHistory: '[none]',
      lastSuccessfulOperationsSummary: '[none]',
      lastSuccessfulOperationsRawJson: '[]',
    });

    expect(prompt.userLines).toContain('[schema tree unavailable]');
    expect(prompt.userLines).not.toContain('Focused Node Context:');
  });
});
