import { describe, expect, it } from 'vitest';

// 通过包名导入契约
import {
  builtinContracts,
  builtinContractMap,
  getBuiltinContract,
} from '@shenbi/schema';
import type { ComponentContract } from '@shenbi/schema';

describe('contracts/runtime verification', () => {
  it('builtinContracts 数量应为 25', () => {
    expect(builtinContracts.length).toBe(25);
  });

  it('builtinContractMap 与 builtinContracts 一致', () => {
    const keys = Object.keys(builtinContractMap);
    expect(keys.length).toBe(builtinContracts.length);
    
    for (const contract of builtinContracts) {
      expect(builtinContractMap[contract.componentType]).toBe(contract);
    }
  });

  it('getBuiltinContract 能正确查询', () => {
    expect(getBuiltinContract('Button')?.componentType).toBe('Button');
    expect(getBuiltinContract('Layout')?.componentType).toBe('Layout');
    expect(getBuiltinContract('Layout.Header')?.componentType).toBe('Layout.Header');
    expect(getBuiltinContract('Form.Item')?.componentType).toBe('Form.Item');
    expect(getBuiltinContract('Tree.DirectoryTree')?.componentType).toBe('Tree.DirectoryTree');
    expect(getBuiltinContract('NonExistent')).toBeUndefined();
  });

  it('所有契约都有必需字段', () => {
    for (const contract of builtinContracts) {
      expect(contract.componentType).toBeTruthy();
      expect(contract.version).toBe('1.0.0');
      expect(contract.runtimeType).toMatch(/^antd\./);
    }
  });

  it('契约 componentType 无重复', () => {
    const types = builtinContracts.map((c) => c.componentType);
    const uniqueTypes = new Set(types);
    expect(uniqueTypes.size).toBe(types.length);
  });
});

describe('contracts/Step1 组件覆盖', () => {
  const step1Components = [
    // Layout
    'Layout',
    'Layout.Header',
    'Layout.Content',
    'Layout.Footer',
    'Layout.Sider',
    // Grid
    'Row',
    'Col',
    // Space
    'Space',
    'Space.Compact',
    // General
    'Button',
    // Data Entry
    'Input',
    'Select',
    'Form',
    'Form.Item',
    // Data Display
    'Card',
    'Table',
    'Tree',
    'Tree.TreeNode',
    'Tree.DirectoryTree',
    'Descriptions',
    'Descriptions.Item',
    // Feedback
    'Modal',
    'Drawer',
    // Navigation
    'Tabs',
    'Tabs.TabPane',
  ];

  it('Step1 全部覆盖', () => {
    for (const componentType of step1Components) {
      const contract = getBuiltinContract(componentType);
      expect(contract, `Missing contract: ${componentType}`).toBeDefined();
    }
  });

  it('Step1 数量一致', () => {
    expect(step1Components.length).toBe(25);
  });
});

describe('contracts/props 结构验证', () => {
  it('Button 契约 props 正确', () => {
    const button = getBuiltinContract('Button') as ComponentContract;
    expect(button.props?.type?.type).toBe('enum');
    expect(button.props?.type?.enum).toContain('primary');
    expect(button.props?.loading?.type).toBe('boolean');
    expect(button.events?.onClick).toBeDefined();
    expect(button.children?.type).toBe('mixed');
  });

  it('Layout.Sider 契约有折叠事件', () => {
    const sider = getBuiltinContract('Layout.Sider') as ComponentContract;
    expect(sider.events?.onCollapse).toBeDefined();
    expect(sider.props?.collapsible?.type).toBe('boolean');
  });

  it('Table 契约有 onChange 事件', () => {
    const table = getBuiltinContract('Table') as ComponentContract;
    expect(table.events?.onChange).toBeDefined();
    expect(table.props?.dataSource?.type).toBe('array');
    expect(table.props?.columns?.type).toBe('array');
  });

  it('Tabs 契约有 items 配置', () => {
    const tabs = getBuiltinContract('Tabs') as ComponentContract;
    expect(tabs.props?.items?.type).toBe('array');
    expect(tabs.props?.type?.enum).toContain('line');
    expect(tabs.events?.onChange).toBeDefined();
  });

  it('Tree 契约有 treeData 配置', () => {
    const tree = getBuiltinContract('Tree') as ComponentContract;
    expect(tree.props?.treeData?.type).toBe('array');
    expect(tree.props?.checkable?.type).toBe('boolean');
    expect(tree.events?.onSelect).toBeDefined();
    expect(tree.events?.onCheck).toBeDefined();
  });

  it('Drawer 契约有 open 属性', () => {
    const drawer = getBuiltinContract('Drawer') as ComponentContract;
    expect(drawer.props?.open?.type).toBe('boolean');
    expect(drawer.props?.placement?.enum).toContain('right');
    expect(drawer.events?.onClose).toBeDefined();
  });

  it('Descriptions 契约正确', () => {
    const desc = getBuiltinContract('Descriptions') as ComponentContract;
    expect(desc.props?.bordered?.type).toBe('boolean');
    expect(desc.props?.column?.default).toBe(3);
    expect(desc.children?.type).toBe('nodes');
  });

  it('废弃属性标记正确', () => {
    const drawer = getBuiltinContract('Drawer') as ComponentContract;
    expect(drawer.props?.width?.deprecated).toBe(true);
    expect(drawer.props?.height?.deprecated).toBe(true);
    
    const tabs = getBuiltinContract('Tabs') as ComponentContract;
    expect(tabs.props?.tabPosition?.deprecated).toBe(true);
  });
});
