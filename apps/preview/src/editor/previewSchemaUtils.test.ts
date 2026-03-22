import { describe, expect, it, vi } from 'vitest';
import {
  canSchemaNodeAcceptCanvasChildren,
  cloneSchemaNodeWithFreshIds,
  isBlockedDuringGeneration,
  resolveCanvasDropPosition,
} from './previewSchemaUtils';

describe('previewSchemaUtils', () => {
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

    expect(canSchemaNodeAcceptCanvasChildren(schema as any, 'card-1')).toBe(true);
    expect(canSchemaNodeAcceptCanvasChildren(schema as any, 'input-1')).toBe(false);
    expect(resolveCanvasDropPosition(schema as any, {
      placement: 'inside',
      targetNodeSchemaId: 'input-1',
    })).toBeUndefined();
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

  it('generation lock 只拦截变更命令', () => {
    expect(isBlockedDuringGeneration('workspace.resetDocument')).toBe(true);
    expect(isBlockedDuringGeneration('node.insertAt')).toBe(true);
    expect(isBlockedDuringGeneration('history.jumpTo')).toBe(true);
    expect(isBlockedDuringGeneration('files.closeActiveTab')).toBe(false);
  });
});
