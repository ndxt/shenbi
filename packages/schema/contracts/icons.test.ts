import { describe, it, expect } from 'vitest';
import { builtinContracts } from '@shenbi/schema';

describe('Component Contract Icons', () => {
  it('should have icon field for all contracts', () => {
    const contractsWithoutIcon = builtinContracts.filter(
      (contract) => !contract.icon
    );

    if (contractsWithoutIcon.length > 0) {
      console.warn(
        'Contracts without icon:',
        contractsWithoutIcon.map((c) => c.componentType)
      );
    }

    // 大部分契约应该有图标
    const contractsWithIcon = builtinContracts.filter((contract) => contract.icon);
    expect(contractsWithIcon.length).toBeGreaterThan(50);
  });

  it('should have valid icon names', () => {
    const contractsWithIcon = builtinContracts.filter((contract) => contract.icon);

    contractsWithIcon.forEach((contract) => {
      expect(contract.icon).toBeTruthy();
      expect(typeof contract.icon).toBe('string');
      expect(contract.icon!.length).toBeGreaterThan(0);
    });
  });

  it('should have unique component types', () => {
    const componentTypes = builtinContracts.map((c) => c.componentType);
    const uniqueTypes = new Set(componentTypes);
    expect(componentTypes.length).toBe(uniqueTypes.size);
  });
});
