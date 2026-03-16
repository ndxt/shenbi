import { describe, expect, it } from 'vitest';
import { builtinContracts, builtinContractMap } from '../types';

/**
 * Snapshot 测试：锁定每个组件契约的 props/events/slots key 列表。
 * 任何契约字段增删都会导致 snapshot 失败，强制人工审查。
 */
describe('contract-keys snapshot', () => {
  for (const contract of builtinContracts) {
    it(`${contract.componentType} keys snapshot`, () => {
      const snapshot = {
        componentType: contract.componentType,
        category: contract.category,
        propKeys: Object.keys(contract.props ?? {}).sort(),
        eventKeys: Object.keys(contract.events ?? {}).sort(),
        slotKeys: Object.keys(contract.slots ?? {}).sort(),
        childrenType: contract.children?.type ?? null,
      };
      expect(snapshot).toMatchSnapshot();
    });
  }

  it('total component count', () => {
    expect(builtinContracts.length).toMatchSnapshot();
  });

  it('contract map keys match contracts array', () => {
    const mapKeys = Object.keys(builtinContractMap).sort();
    const arrayKeys = builtinContracts.map((c) => c.componentType).sort();
    expect(mapKeys).toEqual(arrayKeys);
  });
});
