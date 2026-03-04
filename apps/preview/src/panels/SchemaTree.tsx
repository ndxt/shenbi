import React, { useState } from 'react';
import { ChevronRight, ChevronDown, Layout, Type, Box, Image as ImageIcon, EyeOff } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import type { ComponentContract } from '@shenbi/schema';

export interface SchemaNode {
  id: string;
  type: string;
  name?: string;
  children?: SchemaNode[];
  isHidden?: boolean;
}

const mockSchemaTree: SchemaNode[] = [
  {
    id: 'root',
    type: 'Page',
    name: '页面根节点',
    children: [
      {
        id: 'header',
        type: 'Container',
        name: '头部容器',
        children: [
          { id: 'logo', type: 'Image', name: 'Logo' },
          { id: 'title', type: 'Text', name: '标题文案' }
        ]
      },
      {
        id: 'main',
        type: 'Container',
        name: '主要内容',
        children: [
          {
            id: 'grid-1',
            type: 'Grid',
            name: '数据网格',
            children: [
              { id: 'card-1', type: 'Container', name: '卡片 1' },
              { id: 'card-2', type: 'Container', name: '卡片 2' },
              { id: 'card-3', type: 'Container', name: '卡片 3' }
            ]
          }
        ]
      },
      {
        id: 'footer',
        type: 'Container',
        isHidden: true,
        name: '底部信息',
        children: [
          { id: 'copyright', type: 'Text' }
        ]
      }
    ]
  }
];

export interface SchemaTreeProps {
  nodes?: SchemaNode[];
  selectedNodeId?: string;
  onSelect?: (nodeId: string) => void;
  contracts?: ComponentContract[];
}

export function SchemaTree({ nodes = mockSchemaTree, selectedNodeId, onSelect, contracts = [] }: SchemaTreeProps) {
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());
  const internalSelectedId = selectedNodeId ?? nodes[0]?.id;

  React.useEffect(() => {
    const nextKeys = new Set<string>();
    const walk = (currentNodes: SchemaNode[]) => {
      for (const node of currentNodes) {
        if (node.children && node.children.length > 0) {
          nextKeys.add(node.id);
          walk(node.children);
        }
      }
    };
    walk(nodes);
    setExpandedKeys(nextKeys);
  }, [nodes]);

  const toggleExpand = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newKeys = new Set(expandedKeys);
    if (newKeys.has(id)) {
      newKeys.delete(id);
    } else {
      newKeys.add(id);
    }
    setExpandedKeys(newKeys);
  };

  const getIconFromContract = (componentType: string) => {
    // 快速特判：如果是 Page 或 Container，使用通用图标
    if (componentType === 'Page' || componentType === 'Container') {
      return <Layout size={14} strokeWidth={1.5} />;
    }

    // 查找组件契约
    const contract = contracts.find((c: ComponentContract) => c.componentType === componentType);
    if (!contract || !contract.icon) {
      // 兜底图标
      if (componentType === 'Text') return <Type size={14} strokeWidth={1.5} />;
      if (componentType === 'Image') return <ImageIcon size={14} strokeWidth={1.5} />;
      if (componentType === 'Grid') return <Box size={14} strokeWidth={1.5} />;
      return <Box size={14} strokeWidth={1.5} />;
    }

    const IconComponent = (LucideIcons as any)[contract.icon];
    if (!IconComponent) {
      return <Box size={14} strokeWidth={1.5} />;
    }
    return <IconComponent size={14} strokeWidth={1.5} />;
  };

  const renderNode = (node: SchemaNode, depth: number = 0) => {
    const isExpanded = expandedKeys.has(node.id);
    const isSelected = node.id === internalSelectedId;
    const hasChildren = node.children && node.children.length > 0;
    
    return (
      <div key={node.id}>
        <div 
          className={`flex items-center h-[28px] cursor-pointer text-[12px] group relative transition-colors rounded-sm mx-1
            ${isSelected ? 'bg-blue-500/10 text-blue-500' : 'text-text-primary/90 hover:bg-text-primary/5'}
            ${node.isHidden ? 'opacity-50' : ''}
          `}
          style={{ paddingLeft: `${depth * 14 + 6}px` }}
          onClick={() => onSelect?.(node.id)}
        >
          <div 
            className="w-4 h-4 flex items-center justify-center -ml-1 mr-1 text-text-secondary/70 hover:text-text-primary transition-colors"
            onClick={(e) => hasChildren ? toggleExpand(node.id, e) : undefined}
          >
            {hasChildren && (
              isExpanded ? <ChevronDown size={14} strokeWidth={1.5} /> : <ChevronRight size={14} strokeWidth={1.5} />
            )}
          </div>
          
          {/* Type Icon */}
          <div className={`mr-2 flex items-center justify-center ${isSelected ? 'text-blue-500' : 'text-text-secondary'}`}>
            {getIconFromContract(node.type)}
          </div>
          
          {/* Label */}
          <span className="truncate flex-1">
            {node.name || node.id}
          </span>
          
          {/* Right Actions (Hidden state, etc.) */}
          {node.isHidden && (
            <div className="mr-2 text-text-secondary/60" title="已隐藏">
              <EyeOff size={12} strokeWidth={1.5} />
            </div>
          )}
        </div>
        
        {isExpanded && hasChildren && (
          <div>
            {node.children!.map(child => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="h-full overflow-y-auto bg-bg-sidebar py-2">
      {nodes.map(node => renderNode(node))}
    </div>
  );
}
