import { describe, expect, it } from 'vitest';
import { formatConversationHistory, summarizeOperations } from './conversation-history';
import type { AgentMemoryMessage } from '../types';

describe('conversation history summaries', () => {
  it('renders semantic operation summaries instead of raw op signatures', () => {
    const messages: AgentMemoryMessage[] = [
      {
        role: 'user',
        text: '把搜索框提示改一下',
      },
      {
        role: 'assistant',
        text: '已更新搜索框提示，并新增一个主按钮。',
        meta: {
          operations: [
            {
              op: 'schema.patchProps',
              label: '更新搜索提示',
              nodeId: 'search-input',
              patch: { placeholder: '请输入客户名' },
            },
            {
              op: 'schema.insertNode',
              label: '添加新增按钮',
              parentId: 'toolbar',
              node: {
                id: 'add-btn',
                component: 'Button',
                children: ['新增订单'],
              },
            },
          ],
        },
      },
    ];

    const history = formatConversationHistory(messages);

    expect(history).toContain('更新搜索提示: 修改节点 search-input 的属性 placeholder="请输入客户名"');
    expect(history).toContain('添加新增按钮: 在 节点 toolbar 下插入 Button#add-btn');
    expect(history).not.toContain('schema.patchProps(search-input)');
  });

  it('summarizes batches of operations in readable Chinese', () => {
    const summary = summarizeOperations([
      {
        op: 'schema.patchColumns',
        nodeId: 'table-1',
        columns: [{ title: '订单编号' }, { title: '金额(元)' }, { title: '状态' }],
      },
      {
        op: 'schema.removeNode',
        nodeId: 'old-filter',
      },
    ]);

    expect(summary).toContain('更新节点 table-1 的表格列 [订单编号, 金额(元), 状态]');
    expect(summary).toContain('删除节点 old-filter');
  });
});
