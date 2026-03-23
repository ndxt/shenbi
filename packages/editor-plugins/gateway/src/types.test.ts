import { describe, expect, it } from 'vitest';
import { NODE_CONTRACTS, DRAGGABLE_NODE_KINDS, getNodeContract, getContractInputs, getContractOutputs } from './types';
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
      expect(NODE_CONTRACTS[kind].componentType).toBeTruthy();
      expect(NODE_CONTRACTS[kind].description).toBeTruthy();
    }
  });

  it('start node has no inputs and 1 output', () => {
    const start = getNodeContract('start');
    const inputs = getContractInputs(start);
    const outputs = getContractOutputs(start);
    expect(inputs).toHaveLength(0);
    expect(outputs).toHaveLength(1);
    expect(outputs[0].dataType).toBe('object');
    expect(start.maxInstances).toBe(1);
  });

  it('end node has 1 input and no outputs', () => {
    const end = getNodeContract('end');
    const inputs = getContractInputs(end);
    const outputs = getContractOutputs(end);
    expect(inputs).toHaveLength(1);
    expect(inputs[0].dataType).toBe('any');
    expect(outputs).toHaveLength(0);
  });

  it('sql-query node has correct ports', () => {
    const sql = getNodeContract('sql-query');
    const inputs = getContractInputs(sql);
    const outputs = getContractOutputs(sql);
    expect(inputs).toHaveLength(1);
    expect(inputs[0].dataType).toBe('object');
    expect(outputs).toHaveLength(1);
    expect(outputs.map((o) => o.dataType)).toEqual(['array']);
  });

  it('branch node has 2 outputs (true/false)', () => {
    const branch = getNodeContract('branch');
    const outputs = getContractOutputs(branch);
    expect(outputs).toHaveLength(2);
    expect(outputs.map((o) => o.id)).toEqual(['true', 'false']);
  });

  it('loop-start node has correct input/output types', () => {
    const loopStart = getNodeContract('loop-start');
    const inputs = getContractInputs(loopStart);
    const outputs = getContractOutputs(loopStart);
    expect(inputs[0].dataType).toBe('array');
    expect(outputs).toHaveLength(1);
  });

  it('loop subnodes define bridgeable control-flow ports', () => {
    const loopStart = getNodeContract('loop-start');
    const loopEnd = getNodeContract('loop-end');
    const loopBreak = getNodeContract('loop-break');
    const loopContinue = getNodeContract('loop-continue');

    expect(getContractInputs(loopStart)[0].dataType).toBe('array');
    expect(getContractOutputs(loopStart)).toHaveLength(1);
    expect(getContractInputs(loopEnd)).toHaveLength(1);
    expect(getContractOutputs(loopEnd)).toHaveLength(1);
    expect(getContractInputs(loopBreak)).toHaveLength(1);
    expect(getContractOutputs(loopBreak)).toHaveLength(1);
    expect(getContractInputs(loopContinue)).toHaveLength(1);
    expect(getContractOutputs(loopContinue)).toHaveLength(1);
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
    expect(contract.componentType).toBe('Gateway.Start');
    expect(contract.description).toBe('API 入口节点，接收请求参数');
  });
});
