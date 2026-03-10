import { describe, expect, it, vi } from 'vitest';
import type { PageSchema, SchemaNode } from '@shenbi/schema';
import { executeAgentOperation } from './operation-executor';
import type { EditorAIBridge } from './editor-ai-bridge';

function createSchema(): PageSchema {
  return {
    id: 'page-1',
    body: [
      {
        id: 'container-1',
        component: 'Container',
        children: [
          {
            id: 'card-1',
            component: 'Card',
            children: [],
          },
        ],
      },
    ],
  };
}

function createBridge(schema: PageSchema) {
  const execute = vi.fn(async () => ({ success: true }));
  const bridge: EditorAIBridge = {
    getSchema: () => schema,
    getSelectedNodeId: () => 'card-1',
    getAvailableComponents: () => [],
    execute,
    replaceSchema: vi.fn(),
    appendBlock: vi.fn(),
    removeNode: vi.fn(),
    subscribe: () => () => undefined,
  };
  return { bridge, execute };
}

describe('executeAgentOperation', () => {
  it('maps patchProps operations to node.patchProps with resolved treeId', async () => {
    const { bridge, execute } = createBridge(createSchema());

    const result = await executeAgentOperation(bridge, {
      op: 'schema.patchProps',
      nodeId: 'card-1',
      patch: { title: '本月营收' },
    });

    expect(result).toEqual({ success: true });
    expect(execute).toHaveBeenCalledWith('node.patchProps', {
      treeId: 'body.0.children.0',
      patch: { title: '本月营收' },
    });
  });

  it('uses node.append when insertNode omits index', async () => {
    const { bridge, execute } = createBridge(createSchema());
    const node: SchemaNode = {
      id: 'text-1',
      component: 'Typography.Text',
      children: '新增内容',
    };

    await executeAgentOperation(bridge, {
      op: 'schema.insertNode',
      parentId: 'container-1',
      node,
    });

    expect(execute).toHaveBeenCalledWith('node.append', {
      parentTreeId: 'body.0',
      node,
    });
  });

  it('returns failure when node id cannot be resolved', async () => {
    const { bridge } = createBridge(createSchema());

    const result = await executeAgentOperation(bridge, {
      op: 'schema.removeNode',
      nodeId: 'missing-node',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('missing-node');
  });
});
