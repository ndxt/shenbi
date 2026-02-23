import { describe, expect, it } from 'vitest';
import {
  descriptionsSkeletonSchema,
  drawerDetailSkeletonSchema,
  formListSkeletonSchema,
  tabsDetailSkeletonSchema,
  treeManagementSkeletonSchema,
} from './index';

type AnyNode = Record<string, any>;

function isNode(value: unknown): value is AnyNode {
  return Boolean(value) && typeof value === 'object' && 'component' in (value as AnyNode);
}

function toArray(value: unknown): AnyNode[] {
  if (Array.isArray(value)) {
    return value.filter(isNode);
  }
  return isNode(value) ? [value] : [];
}

function collectNodes(root: AnyNode[] | AnyNode): AnyNode[] {
  const queue = Array.isArray(root) ? [...root] : [root];
  const result: AnyNode[] = [];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || !isNode(current)) {
      continue;
    }
    result.push(current);

    for (const child of toArray(current.children)) {
      queue.push(child);
    }
    const slots = current.slots;
    if (slots && typeof slots === 'object') {
      for (const slotValue of Object.values(slots)) {
        for (const slotChild of toArray(slotValue)) {
          queue.push(slotChild);
        }
      }
    }
  }

  return result;
}

describe('phase2 scenario schemas', () => {
  it('Form.List 场景包含动态增删与校验提交流程', () => {
    expect(formListSkeletonSchema.methods?.addContactRow).toBeDefined();
    expect(formListSkeletonSchema.methods?.removeContactRow).toBeDefined();
    expect(formListSkeletonSchema.methods?.moveContactRowUp).toBeDefined();
    expect(formListSkeletonSchema.methods?.moveContactRowDown).toBeDefined();
    expect(formListSkeletonSchema.methods?.submitContacts).toBeDefined();

    const dialogs = formListSkeletonSchema.dialogs ?? [];
    const dialog = dialogs.find((item) => item.id === 'formListDialog');
    expect(dialog?.component).toBe('Modal');

    const nodes = collectNodes(dialog ?? []);
    expect(nodes.some((node) => node.component === 'Form' && node.id === 'contact-list-form')).toBe(true);
    expect(nodes.some((node) => node.component === 'Container' && node.loop)).toBe(true);
  });

  it('Tabs 场景支持 activeKey 与 visitedTabs 状态更新', () => {
    expect(tabsDetailSkeletonSchema.state?.activeTab?.default).toBe('basic');
    expect(tabsDetailSkeletonSchema.state?.visitedTabs?.default).toEqual(['basic']);

    const nodes = collectNodes(tabsDetailSkeletonSchema.body as AnyNode);
    const tabsNode = nodes.find((node) => node.component === 'Tabs');
    expect(tabsNode).toBeDefined();
    expect(Array.isArray(tabsNode?.events?.onChange)).toBe(true);
    expect((tabsNode?.events?.onChange ?? []).length).toBeGreaterThan(1);
  });

  it('Tree 场景包含选中/展开/勾选与 loadData 配置', () => {
    const nodes = collectNodes(treeManagementSkeletonSchema.body as AnyNode);
    const treeNode = nodes.find((node) => node.component === 'Tree');
    expect(treeNode).toBeDefined();
    expect(treeNode?.events?.onSelect).toBeDefined();
    expect(treeNode?.events?.onExpand).toBeDefined();
    expect(treeNode?.events?.onCheck).toBeDefined();
    expect(treeNode?.props?.loadData?.type).toBe('JSFunction');
  });

  it('Descriptions 场景包含状态切换方法与详情字段', () => {
    expect(descriptionsSkeletonSchema.methods?.toggleStatus).toBeDefined();

    const nodes = collectNodes(descriptionsSkeletonSchema.body as AnyNode);
    expect(nodes.some((node) => node.component === 'Button' && node.children === '切换状态')).toBe(true);
    expect(
      nodes.some(
        (node) =>
          node.component === 'Descriptions.Item'
          && node.props?.label === '部门',
      ),
    ).toBe(true);
  });

  it('Drawer 场景通过 page.dialogs 中的 Drawer 展示详情', () => {
    const dialogs = drawerDetailSkeletonSchema.dialogs ?? [];
    const drawerDialog = dialogs.find((item) => item.id === 'orderDetailDrawer');
    expect(drawerDialog?.component).toBe('Drawer');

    const bodyNodes = collectNodes(drawerDetailSkeletonSchema.body as AnyNode);
    expect(
      bodyNodes.some(
        (node) =>
          node.component === 'Button'
          && node.children === '查看详情',
      ),
    ).toBe(true);
  });
});
