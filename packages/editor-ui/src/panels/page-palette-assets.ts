import type { ComponentContract } from '@shenbi/schema';
import type { PaletteAsset, PaletteAssetGroup } from './palette-model';

const COMPONENT_DESCRIPTION_KEYS: Record<string, string> = {
  Layout: 'component.layout',
  'Layout.Header': 'component.layoutHeader',
  'Layout.Content': 'component.layoutContent',
  'Layout.Footer': 'component.layoutFooter',
  'Layout.Sider': 'component.layoutSider',
  FloatButton: 'component.floatButton',
  'FloatButton.Group': 'component.floatButtonGroup',
  'FloatButton.BackTop': 'component.floatButtonBackTop',
  Typography: 'component.typography',
  'Typography.Title': 'component.typographyTitle',
  'Typography.Text': 'component.typographyText',
  'Typography.Link': 'component.typographyLink',
  'Typography.Paragraph': 'component.typographyParagraph',
  Tabs: 'component.tabs',
  'Tabs.TabPane': 'component.tabsTabPane',
  Space: 'component.space',
  'Space.Compact': 'component.spaceCompact',
  Tree: 'component.tree',
  'Tree.DirectoryTree': 'component.treeDirectoryTree',
  Skeleton: 'component.skeleton',
  'Skeleton.Button': 'component.skeletonButton',
  'Skeleton.Avatar': 'component.skeletonAvatar',
  'Skeleton.Input': 'component.skeletonInput',
  'Skeleton.Image': 'component.skeletonImage',
  Row: 'component.row',
  Col: 'component.col',
  Flex: 'component.flex',
  Divider: 'component.divider',
  Anchor: 'component.anchor',
  Breadcrumb: 'component.breadcrumb',
  Dropdown: 'component.dropdown',
  Menu: 'component.menu',
  Pagination: 'component.pagination',
  Steps: 'component.steps',
  Button: 'component.button',
  Input: 'component.input',
  Select: 'component.select',
  Table: 'component.table',
  Form: 'component.form',
  'Form.Item': 'component.formItem',
};

type TranslateFn = (key: string, ...args: any[]) => string;

function getCategoryName(category: string, t: TranslateFn): string {
  const names: Record<string, string> = {
    general: t('category.general'),
    layout: t('category.layout'),
    navigation: t('category.navigation'),
    chart: t('category.chart'),
    'data-entry': t('category.dataEntry'),
    'data-display': t('category.dataDisplay'),
    feedback: t('category.feedback'),
    other: t('category.other'),
  };
  return names[category] || t('category.uncategorized');
}

function getContractName(contract: ComponentContract, t: TranslateFn): string {
  return contract.displayNameKey
    ? t(contract.displayNameKey, {
        defaultValue: contract.componentType.split('.').pop() || contract.componentType,
      })
    : contract.componentType.split('.').pop() || contract.componentType;
}

function getContractDescription(contract: ComponentContract, t: TranslateFn): string | undefined {
  const descriptionKey = COMPONENT_DESCRIPTION_KEYS[contract.componentType];
  const rawDescription = (contract as { description?: string }).description;
  if (!descriptionKey) {
    return rawDescription;
  }
  return t(descriptionKey, { defaultValue: rawDescription });
}

function buildComponentAssets(
  contracts: ComponentContract[],
  category: string,
  categoryName: string,
  t: TranslateFn,
): PaletteAsset[] {
  const assetMap = new Map<string, PaletteAsset>();

  contracts.forEach((contract) => {
    const name = getContractName(contract, t);
    const description = getContractDescription(contract, t);

    assetMap.set(contract.componentType, {
      id: contract.componentType,
      type: contract.componentType,
      name,
      ...(description ? { description } : {}),
      ...(contract.icon ? { icon: contract.icon } : {}),
      sourceType: 'component',
      groupId: category,
      groupName: categoryName,
      dragPayload: {
        kind: 'component',
        type: contract.componentType,
        label: name,
        ...(description ? { description } : {}),
        ...(contract.icon ? { icon: contract.icon } : {}),
      },
      draggable: true,
      visibility: {
        sidebar: true,
      },
      children: [],
    });
  });

  const roots: PaletteAsset[] = [];
  assetMap.forEach((asset, id) => {
    if (!id.includes('.')) {
      roots.push(asset);
      return;
    }

    const parentId = id.substring(0, id.lastIndexOf('.'));
    const parent = assetMap.get(parentId);
    if (parent) {
      parent.children = [...(parent.children ?? []), asset];
      return;
    }
    roots.push(asset);
  });

  return roots;
}

export function buildPagePaletteAssets(
  contracts: ComponentContract[],
  t: TranslateFn,
): PaletteAssetGroup[] {
  return Object.entries(
    contracts.reduce<Record<string, ComponentContract[]>>((acc, contract) => {
      const category = contract.category ?? 'other';
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(contract);
      return acc;
    }, {}),
  ).map(([category, items]) => {
    const groupName = getCategoryName(category, t);
    return {
      id: category,
      name: groupName,
      assets: buildComponentAssets(items, category, groupName, t),
    };
  });
}
