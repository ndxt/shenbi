import { describe, expect, it } from 'vitest';
import { NODE_CONTRACTS, DRAGGABLE_NODE_KINDS, getNodeContract } from './types';
import type { GatewayNodeKind } from './types';

describe('NODE_CONTRACTS', () => {
  it('defines all gateway node kinds including loop subnodes', () => {
    const kinds: GatewayNodeKind[] = [
      'start',
      'end',
      'data-definition',
      'metadata',
      'sql-query',
      'branch',
      'loop-start',
      'loop-end',
      'loop-break',
      'loop-continue',
    ];
    for (const kind of kinds) {
      expect(NODE_CONTRACTS[kind]).toBeDefined();
      expect(NODE_CONTRACTS[kind].kind).toBe(kind);
      expect(NODE_CONTRACTS[kind].label).toBeTruthy();
    }
  });

  it('start node has no inputs and 1 output', () => {
    const start = NODE_CONTRACTS.start;
    expect(start.inputs).toHaveLength(0);
    expect(start.outputs).toHaveLength(1);
    expect(start.outputs[0].dataType).toBe('object');
    expect(start.maxInstances).toBe(1);
  });

  it('end node has 1 input and no outputs', () => {
    const end = NODE_CONTRACTS.end;
    expect(end.inputs).toHaveLength(1);
    expect(end.inputs[0].dataType).toBe('any');
    expect(end.outputs).toHaveLength(0);
    expect(end.maxInstances).toBe(1);
  });

  it('sql-query node has correct ports', () => {
    const sql = NODE_CONTRACTS['sql-query'];
    expect(sql.inputs).toHaveLength(1);
    expect(sql.inputs[0].dataType).toBe('object');
    expect(sql.outputs).toHaveLength(1);
    expect(sql.outputs.map((o) => o.dataType)).toEqual(['array']);
  });

  it('branch node has 2 outputs (true/false)', () => {
    const branch = NODE_CONTRACTS.branch;
    expect(branch.outputs).toHaveLength(2);
    expect(branch.outputs.map((o) => o.id)).toEqual(['true', 'false']);
  });

  it('loop-start node has correct input/output types', () => {
    const loopStart = NODE_CONTRACTS['loop-start'];
    expect(loopStart.inputs[0].dataType).toBe('array');
    expect(loopStart.outputs).toHaveLength(1);
  });

  it('loop subnodes define bridgeable control-flow ports', () => {
    const loopStart = NODE_CONTRACTS['loop-start'];
    const loopEnd = NODE_CONTRACTS['loop-end'];
    const loopBreak = NODE_CONTRACTS['loop-break'];
    const loopContinue = NODE_CONTRACTS['loop-continue'];

    expect(loopStart.inputs[0].dataType).toBe('array');
    expect(loopStart.outputs).toHaveLength(1);
    expect(loopEnd.inputs).toHaveLength(1);
    expect(loopEnd.outputs).toHaveLength(1);
    expect(loopBreak.inputs).toHaveLength(1);
    expect(loopBreak.outputs).toHaveLength(1);
    expect(loopContinue.inputs).toHaveLength(1);
    expect(loopContinue.outputs).toHaveLength(1);
  });
});

describe('DRAGGABLE_NODE_KINDS', () => {
  it('excludes only start from draggable node kinds', () => {
    expect(DRAGGABLE_NODE_KINDS).not.toContain('start');
  });

  it('includes visible insertable gateway node kinds', () => {
    expect(DRAGGABLE_NODE_KINDS).toContain('end');
    expect(DRAGGABLE_NODE_KINDS).toContain('data-definition');
    expect(DRAGGABLE_NODE_KINDS).toContain('metadata');
    expect(DRAGGABLE_NODE_KINDS).toContain('sql-query');
    expect(DRAGGABLE_NODE_KINDS).toContain('branch');
    expect(DRAGGABLE_NODE_KINDS).not.toContain('loop');
    expect(DRAGGABLE_NODE_KINDS).toContain('loop-start');
    expect(DRAGGABLE_NODE_KINDS).toContain('loop-end');
    expect(DRAGGABLE_NODE_KINDS).toContain('loop-break');
    expect(DRAGGABLE_NODE_KINDS).toContain('loop-continue');
  });
});

describe('getNodeContract', () => {
  it('returns the correct contract for a kind', () => {
    const contract = getNodeContract('start');
    expect(contract.kind).toBe('start');
    expect(contract.label).toBe('开始');
  });
});
