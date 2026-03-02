import React, { useState } from 'react';
import { Search, List, Box, Layout, Type, Image as ImageIcon } from 'lucide-react';
import type { ComponentContract } from '@shenbi/schema';

interface ComponentGroup {
  id: string;
  name: string;
  components: ComponentItem[];
}

interface ComponentItem {
  id: string;
  name: string;
  icon: React.ReactNode;
  description?: string;
}

const mockComponentGroups: ComponentGroup[] = [
  {
    id: 'basic',
    name: '基础组件',
    components: [
      { id: 'Text', name: '文本', icon: <Type size={16} /> },
      { id: 'Image', name: '图片', icon: <ImageIcon size={16} /> },
      { id: 'Button', name: '按钮', icon: <Box size={16} /> },
    ],
  },
  {
    id: 'layout',
    name: '布局组件',
    components: [
      { id: 'Container', name: '容器', icon: <Layout size={16} /> },
      { id: 'Flex', name: '弹性布局', icon: <Layout size={16} /> },
      { id: 'Grid', name: '网格布局', icon: <Layout size={16} /> },
      { id: 'Divider', name: '分割线', icon: <span className="text-secondary">-</span> },
    ],
  },
  {
    id: 'data',
    name: '数据展示',
    components: [
      { id: 'List', name: '列表', icon: <List size={16} /> },
      { id: 'Table', name: '表格', icon: <Box size={16} /> },
    ],
  },
];

export interface ComponentPanelProps {
  contracts?: ComponentContract[];
  onInsert?: (componentType: string) => void;
}

function getCategoryName(category: string): string {
  switch (category) {
    case 'general':
      return '通用组件';
    case 'layout':
      return '布局组件';
    case 'navigation':
      return '导航组件';
    case 'data-entry':
      return '数据录入';
    case 'data-display':
      return '数据展示';
    case 'feedback':
      return '反馈组件';
    case 'other':
      return '其他';
    default:
      return '未分类';
  }
}

function getIconByType(componentType: string): React.ReactNode {
  if (componentType.includes('Layout') || componentType === 'Row' || componentType === 'Col') {
    return <Layout size={16} />;
  }
  if (componentType.includes('Input') || componentType === 'Typography.Text') {
    return <Type size={16} />;
  }
  if (componentType.includes('Image')) {
    return <ImageIcon size={16} />;
  }
  if (componentType.includes('Table') || componentType.includes('List')) {
    return <List size={16} />;
  }
  return <Box size={16} />;
}

export function ComponentPanel({ contracts, onInsert }: ComponentPanelProps) {
  const [searchTerm, setSearchTerm] = useState('');

  const sourceGroups: ComponentGroup[] =
    contracts && contracts.length > 0
      ? Object.entries(
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
          name: getCategoryName(category),
          components: items.map((contract) => ({
            id: contract.componentType,
            name: contract.componentType,
            icon: getIconByType(contract.componentType),
          })),
        }))
      : mockComponentGroups;

  const filteredGroups = sourceGroups
    .map((group) => ({
      ...group,
      components: group.components.filter(
        (c) =>
          c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          c.id.toLowerCase().includes(searchTerm.toLowerCase()),
      ),
    }))
    .filter((group) => group.components.length > 0);

  return (
    <div className="flex flex-col h-full bg-bg-sidebar text-text-primary">
      <div className="p-3 border-b border-border-ide">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1.5 text-text-secondary" />
          <input
            type="text"
            placeholder="搜索组件..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-bg-activity-bar border border-border-ide rounded-sm pl-8 pr-2 py-1 text-[12px] text-text-primary focus:outline-none focus:border-blue-500 placeholder-text-secondary"
          />
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-2">
        {filteredGroups.map(group => (
          <div key={group.id} className="mb-4">
            <h3 className="text-[11px] font-bold text-text-secondary uppercase mb-2 px-1">
              {group.name}
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {group.components.map(comp => (
                <div
                  key={comp.id}
                  onClick={() => onInsert?.(comp.id)}
                  className="flex flex-col items-center justify-center p-3 bg-bg-canvas border border-border-ide rounded cursor-pointer hover:border-blue-500 hover:text-blue-500 transition-colors group"
                >
                  <div className="text-text-secondary group-hover:text-blue-500 mb-1">
                    {comp.icon}
                  </div>
                  <span className="text-[11px]">{comp.name}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
        {filteredGroups.length === 0 && (
          <div className="text-center text-text-secondary text-[12px] mt-8">
            没有找到相关组件
          </div>
        )}
      </div>
    </div>
  );
}
