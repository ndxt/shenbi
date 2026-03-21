import { describe, expect, it } from 'vitest';
import { createSchemaNodeFromContract } from './create-schema-node';
import type { ComponentContract } from './contract';

describe('createSchemaNodeFromContract', () => {
  it('creates a schema node with generated id and default props', () => {
    const contract: ComponentContract = {
      componentType: 'Button',
      version: '1.0.0',
      props: {
        type: {
          type: 'string',
          default: 'primary',
        },
        danger: {
          type: 'boolean',
          default: false,
        },
      },
      children: {
        type: 'none',
      },
    };

    const node = createSchemaNodeFromContract(contract);

    expect(node.component).toBe('Button');
    expect(node.id).toMatch(/^button-/);
    expect(node.props).toEqual({
      type: 'primary',
      danger: false,
    });
    expect(node.children).toBeUndefined();
  });

  it('initializes empty children for container-like components', () => {
    const contract: ComponentContract = {
      componentType: 'Container',
      version: '1.0.0',
      children: {
        type: 'nodes',
      },
    };

    const node = createSchemaNodeFromContract(contract, { id: 'container-custom' });

    expect(node).toEqual({
      id: 'container-custom',
      component: 'Container',
      children: [],
    });
  });

  it('deep clones object defaults so later mutations do not leak', () => {
    const contract: ComponentContract = {
      componentType: 'Table',
      version: '1.0.0',
      props: {
        pagination: {
          type: 'object',
          default: {
            pageSize: 10,
          },
        },
      },
      children: {
        type: 'none',
      },
    };

    const first = createSchemaNodeFromContract(contract);
    const second = createSchemaNodeFromContract(contract);

    (first.props?.pagination as { pageSize: number }).pageSize = 20;

    expect(second.props).toEqual({
      pagination: {
        pageSize: 10,
      },
    });
  });
});
