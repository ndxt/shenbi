import React, { useState } from 'react';
import { ChevronRight, ChevronDown, Layout, Type, Box, Image as ImageIcon, EyeOff } from 'lucide-react';

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
}

export function SchemaTree({ nodes = mockSchemaTree, selectedNodeId, onSelect }: SchemaTreeProps) {
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

  const getIconForType = (type: string) => {
    switch (type) {
      case 'Page':
      case 'Container': return <Layout size={14} />;
      case 'Text': return <Type size={14} />;
      case 'Image': return <ImageIcon size={14} />;
      case 'Grid': return <Box size={14} />;
      default: return <Box size={14} />;
    }
  };

  const renderNode = (node: SchemaNode, depth: number = 0) => {
    const isExpanded = expandedKeys.has(node.id);
    const isSelected = node.id === internalSelectedId;
    const hasChildren = node.children && node.children.length > 0;
    
    return (
      <div key={node.id}>
        <div 
          className={`flex items-center h-[26px] cursor-pointer text-[13px] group relative
            ${isSelected ? 'bg-blue-500/20 text-blue-500' : 'text-text-primary hover:bg-bg-activity-bar'}
            ${node.isHidden ? 'opacity-50' : ''}
          `}
          style={{ paddingLeft: `${depth * 14 + 10}px` }}
          onClick={() => onSelect?.(node.id)}
        >
          {/* Collapse/Expand Icon */}
          <div 
            className="w-4 h-4 flex items-center justify-center -ml-1 mr-1 text-text-secondary"
            onClick={(e) => hasChildren ? toggleExpand(node.id, e) : undefined}
          >
            {hasChildren && (
              isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />
            )}
          </div>
          
          {/* Type Icon */}
          <div className={`mr-2 flex items-center justify-center ${isSelected ? 'text-blue-500' : 'text-text-secondary'}`}>
            {getIconForType(node.type)}
          </div>
          
          {/* Label */}
          <span className="truncate flex-1">
            {node.name || node.id}
          </span>
          
          {/* Right Actions (Hidden state, etc.) */}
          {node.isHidden && (
            <div className="mr-2 text-text-secondary" title="已隐藏">
              <EyeOff size={12} />
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
