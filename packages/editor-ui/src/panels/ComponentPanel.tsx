import React from 'react';
import type { ComponentContract } from '@shenbi/schema';
import { useTranslation } from '@shenbi/i18n';
import {
  PalettePanel,
  type PaletteGroup,
  type PaletteItem,
} from './PalettePanel';

const COMPONENT_DESCRIPTION_KEYS: Record<string, string> = {
  'Layout': 'component.layout',
  'Layout.Header': 'component.layoutHeader',
  'Layout.Content': 'component.layoutContent',
  'Layout.Footer': 'component.layoutFooter',
  'Layout.Sider': 'component.layoutSider',
  'FloatButton': 'component.floatButton',
  'FloatButton.Group': 'component.floatButtonGroup',
  'FloatButton.BackTop': 'component.floatButtonBackTop',
  'Typography': 'component.typography',
  'Typography.Title': 'component.typographyTitle',
  'Typography.Text': 'component.typographyText',
  'Typography.Link': 'component.typographyLink',
  'Typography.Paragraph': 'component.typographyParagraph',
  'Tabs': 'component.tabs',
  'Tabs.TabPane': 'component.tabsTabPane',
  'Space': 'component.space',
  'Space.Compact': 'component.spaceCompact',
  'Tree': 'component.tree',
  'Tree.DirectoryTree': 'component.treeDirectoryTree',
  'Skeleton': 'component.skeleton',
  'Skeleton.Button': 'component.skeletonButton',
  'Skeleton.Avatar': 'component.skeletonAvatar',
  'Skeleton.Input': 'component.skeletonInput',
  'Skeleton.Image': 'component.skeletonImage',
  'Row': 'component.row',
  'Col': 'component.col',
  'Flex': 'component.flex',
  'Divider': 'component.divider',
  'Anchor': 'component.anchor',
  'Breadcrumb': 'component.breadcrumb',
  'Dropdown': 'component.dropdown',
  'Menu': 'component.menu',
  'Pagination': 'component.pagination',
  'Steps': 'component.steps',
  'Button': 'component.button',
  'Input': 'component.input',
  'Select': 'component.select',
  'Table': 'component.table',
  'Form': 'component.form',
  'Form.Item': 'component.formItem',
};

type TranslateFn = (key: string, ...args: any[]) => string;

function buildComponentTree(
  contracts: ComponentContract[],
  t: TranslateFn,
): PaletteItem[] {
  const treeMap = new Map<string, PaletteItem>();

  contracts.forEach((contract) => {
    const descriptionKey = COMPONENT_DESCRIPTION_KEYS[contract.componentType];
    const componentNameKey = contract.displayNameKey;
    treeMap.set(contract.componentType, {
      id: contract.componentType,
      type: contract.componentType,
      name: componentNameKey
        ? t(componentNameKey, { defaultValue: contract.componentType.split('.').pop() || contract.componentType })
        : contract.componentType.split('.').pop() || contract.componentType,
      icon: contract.icon,
      description: descriptionKey
        ? t(descriptionKey, { defaultValue: (contract as { description?: string }).description })
        : (contract as { description?: string }).description,
      children: [],
      dragPayload: {
        kind: 'component',
        type: contract.componentType,
        label: componentNameKey
          ? t(componentNameKey, { defaultValue: contract.componentType.split('.').pop() || contract.componentType })
          : contract.componentType.split('.').pop() || contract.componentType,
        ...(descriptionKey
          ? { description: t(descriptionKey, { defaultValue: (contract as { description?: string }).description }) }
          : ((contract as { description?: string }).description ? { description: (contract as { description?: string }).description } : {})),
        ...(contract.icon ? { icon: contract.icon } : {}),
      },
    });
  });

  const roots: PaletteItem[] = [];

  treeMap.forEach((item, id) => {
    if (id.includes('.')) {
      const parentId = id.substring(0, id.lastIndexOf('.'));
      const parent = treeMap.get(parentId);
      if (parent) {
        parent.children = [...(parent.children ?? []), item];
      } else {
        roots.push(item);
      }
      return;
    }
    roots.push(item);
  });

  return roots;
}

export interface ComponentPanelProps {
  contracts?: ComponentContract[];
  onInsert?: (componentType: string) => void;
  onStartDrag?: (componentType: string) => void;
  onEndDrag?: () => void;
}

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

export function ComponentPanel({
  contracts = [],
  onInsert,
  onStartDrag,
  onEndDrag,
}: ComponentPanelProps) {
  const { t } = useTranslation('editorUi');

  const groups: PaletteGroup[] = Object.entries(
    contracts.reduce<Record<string, ComponentContract[]>>((acc, contract) => {
      const category = contract.category ?? 'other';
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(contract);
      return acc;
    }, {}),
  ).map(([category, items]) => ({
    id: category,
    name: getCategoryName(category, t as unknown as TranslateFn),
    items: buildComponentTree(items, t as unknown as TranslateFn),
  }));

  return (
    <PalettePanel
      groups={groups}
      layout="grid"
      onInsert={(payload) => onInsert?.(payload.type)}
      onStartDrag={(payload) => onStartDrag?.(payload.type)}
      onEndDrag={onEndDrag}
    />
  );
}
