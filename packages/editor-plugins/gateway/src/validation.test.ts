import { describe, expect, it } from 'vitest';
import { isPortTypeCompatible, isValidConnection } from './validation';
import type { GatewayNode, GatewayEdge, GatewayNodeData } from './types';

describe('isPortTypeCompatible', () => {
  it('any is compatible with everything', () => {
    expect(isPortTypeCompatible('any', 'string')).toBe(true);
    expect(isPortTypeCompatible('string', 'any')).toBe(true);
    expect(isPortTypeCompatible('any', 'any')).toBe(true);
  });

  it('same types are compatible', () => {
    expect(isPortTypeCompatible('string', 'string')).toBe(true);
    expect(isPortTypeCompatible('number', 'number')).toBe(true);
    expect(isPortTypeCompatible('object', 'object')).toBe(true);
    expect(isPortTypeCompatible('array', 'array')).toBe(true);
  });

  it('different types are incompatible', () => {
    expect(isPortTypeCompatible('string', 'number')).toBe(false);
    expect(isPortTypeCompatible('object', 'array')).toBe(false);
    expect(isPortTypeCompatible('boolean', 'string')).toBe(false);
  });

  it('void is only compatible with void or any', () => {
    expect(isPortTypeCompatible('void', 'any')).toBe(true);
    expect(isPortTypeCompatible('void', 'void')).toBe(true);
    expect(isPortTypeCompatible('void', 'string')).toBe(false);
    expect(isPortTypeCompatible('string', 'void')).toBe(false);
  });
});

describe('isValidConnection', () => {
  function makeNode(id: string, kind: string): GatewayNode {
    return {
      id,
      type: kind,
      position: { x: 0, y: 0 },
      data: { kind, label: kind, config: {} } as GatewayNodeData,
    };
  }

  const startNode = makeNode('start-1', 'start');
  const endNode = makeNode('end-1', 'end');
  const sqlNode = makeNode('sql-1', 'sql-query');
  const dataDefNode = makeNode('dd-1', 'data-definition');

  it('allows valid connection: start -> sql-query (object -> object)', () => {
    const result = isValidConnection(
      { source: 'start-1', target: 'sql-1', sourceHandle: 'request', targetHandle: 'params' },
      [startNode, sqlNode],
      [],
    );
    expect(result).toBe(true);
  });

  it('allows valid connection: sql-query rows -> end (array -> any)', () => {
    const result = isValidConnection(
      { source: 'sql-1', target: 'end-1', sourceHandle: 'rows', targetHandle: 'result' },
      [sqlNode, endNode],
      [],
    );
    expect(result).toBe(true);
  });

  it('rejects self-loop', () => {
    const result = isValidConnection(
      { source: 'sql-1', target: 'sql-1', sourceHandle: 'rows', targetHandle: 'params' },
      [sqlNode],
      [],
    );
    expect(result).toBe(false);
  });

  it('rejects duplicate input edge on same target handle', () => {
    const existingEdge: GatewayEdge = {
      id: 'e1',
      source: 'start-1',
      target: 'sql-1',
      sourceHandle: 'request',
      targetHandle: 'params',
    };
    const result = isValidConnection(
      { source: 'dd-1', target: 'sql-1', sourceHandle: 'output', targetHandle: 'params' },
      [startNode, sqlNode, dataDefNode],
      [existingEdge],
    );
    expect(result).toBe(false);
  });

  it('rejects invalid port ids', () => {
    const result = isValidConnection(
      { source: 'start-1', target: 'sql-1', sourceHandle: 'nonexistent', targetHandle: 'params' },
      [startNode, sqlNode],
      [],
    );
    expect(result).toBe(false);
  });

  it('rejects incompatible types: sql-query count (number) -> sql-query params (object)', () => {
    const sqlNode2 = makeNode('sql-2', 'sql-query');
    const result = isValidConnection(
      { source: 'sql-1', target: 'sql-2', sourceHandle: 'count', targetHandle: 'params' },
      [sqlNode, sqlNode2],
      [],
    );
    expect(result).toBe(false);
  });
});
