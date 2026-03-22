import { describe, expect, it, vi } from 'vitest';
import {
  canSchemaNodeAcceptCanvasChildren,
  cloneSchemaNodeWithFreshIds,
  getTreeArrayPosition,
  resolveCanvasDropPosition,
} from './schema-tree-utils';

describe('schema-tree-utils', () => {
  it('只允许容器节点接受 inside 落点', () => {
    const schema = {
      id: 'page-1',
      body: [
        {
          id: 'card-1',
          component: 'Card',
          children: [],
        },
        {
          id: 'input-1',
          component: 'Input',
        },
      ],
    };
    const resolveContract = (componentType: string) => (
      componentType === 'Card'
        ? { children: { type: 'nodes' } }
        : undefined
    );

    expect(canSchemaNodeAcceptCanvasChildren(schema as any, 'card-1', resolveContract)).toBe(true);
    expect(canSchemaNodeAcceptCanvasChildren(schema as any, 'input-1', resolveContract)).toBe(false);
    expect(resolveCanvasDropPosition(schema as any, {
      placement: 'inside',
      targetNodeSchemaId: 'input-1',
    }, resolveContract)).toBeUndefined();
  });

  it('复制节点时会为整棵子树刷新 id', () => {
    vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue(
      '11111111-1111-1111-1111-111111111111',
    );

    const cloned = cloneSchemaNodeWithFreshIds({
      id: 'card-1',
      component: 'Card',
      children: [
        {
          id: 'input-1',
          component: 'Input',
        },
      ],
    } as any);

    expect(cloned.id).toBe('card-11111111');
    expect((cloned.children as any[])?.[0]?.id).toBe('input-11111111');
  });

  it('会解析 body 和 children 数组位置', () => {
    expect(getTreeArrayPosition('body.2')).toEqual({ index: 2 });
    expect(getTreeArrayPosition('body.0.children.1')).toEqual({
      targetParentTreeId: 'body.0',
      index: 1,
    });
  });
});
