import { describe, expect, it } from 'vitest';
import type { PageSchema } from '@shenbi/schema';
import { buildFocusedNodeContext, resolveSelectedNodeContext } from './selected-node-context';

function createSchema(): PageSchema {
  return {
    id: 'page-1',
    body: [
      {
        id: 'toolbar',
        component: 'Container',
        children: [
          {
            id: 'search-input',
            component: 'Input',
            props: { placeholder: '请输入客户名' },
          },
          {
            id: 'add-btn',
            component: 'Button',
            props: { type: 'primary' },
            children: ['新增订单'],
          },
          {
            id: 'reset-btn',
            component: 'Button',
            children: ['重置'],
          },
        ],
      },
    ],
  };
}

describe('selected node context', () => {
  it('resolves editor paths into schema node ids with parent and sibling context', () => {
    const resolved = resolveSelectedNodeContext(createSchema(), 'body.0.children.1');

    expect(resolved).toMatchObject({
      selectionType: 'editor-path',
      path: 'body.0.children.1',
      resolvedNodeId: 'add-btn',
    });
    expect(resolved?.previousSibling?.id).toBe('search-input');
    expect(resolved?.nextSibling?.id).toBe('reset-btn');
    expect(resolved?.ancestors.map((node) => node.id)).toEqual(['toolbar']);
  });

  it('builds a focused node context block with resolved node, parents, siblings, and local subtree', () => {
    const context = buildFocusedNodeContext(createSchema(), 'body.0.children.1');

    expect(context).toContain('Focused selection path: "body.0.children.1".');
    expect(context).toContain('Resolved focused node: Button#add-btn(type="primary", text="新增订单")');
    expect(context).toContain('Use resolved schema nodeId "add-btn"');
    expect(context).toContain('Parent chain:');
    expect(context).toContain('- Container#toolbar');
    expect(context).toContain('- Previous: Input#search-input(placeholder="请输入客户名")');
    expect(context).toContain('- Next: Button#reset-btn(text="重置")');
    expect(context).toContain('Local subtree:');
    expect(context).toContain('Button#add-btn(type="primary", text="新增订单")');
  });
});
