import React, { useState, useRef, useEffect } from 'react';
import {
  Search,
  Box,
  ChevronRight,
  Info,
  type LucideIcon,
} from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import type { ComponentContract } from '@shenbi/schema';

// 组件元数据：说明文字
const COMPONENT_METADATA: Record<string, string> = {
  'Layout': '页面整体布局容器，支持顶部、底部、侧边栏等区域。',
  'Layout.Header': '页面顶部导航栏，常用于 Logo、菜单、用户信息。',
  'Layout.Content': '页面主要内容区域，自动填充剩余空间。',
  'Layout.Footer': '页面底部版权栏或辅助信息栏。',
  'Layout.Sider': '侧边栏容器，支持展开收起。',
  'FloatButton': '悬浮按钮，固定在页面右下角，常用于反馈、回到顶部。',
  'FloatButton.Group': '悬浮按钮组，可以将多个悬浮按钮组合在一起。',
  'FloatButton.BackTop': '回到顶部按钮。',
  'Typography': '排版组件，提供标题、文本、链接等基础排版。',
  'Typography.Title': '标题组件。',
  'Typography.Text': '普通文本组件。',
  'Typography.Link': '链接文本。',
  'Typography.Paragraph': '段落文本。',
  'Tabs': '选项卡切换组件。',
  'Tabs.TabPane': '选项卡面板内容。',
  'Space': '间距组件，用于统一设置组件间的间距。',
  'Space.Compact': '紧凑排列的组件组。',
  'Tree': '树形展示组件。',
  'Tree.DirectoryTree': '目录结构的树。',
  'Skeleton': '骨架屏，在页面加载时提供视觉占位。',
  'Skeleton.Button': '按钮样式的骨架。',
  'Skeleton.Avatar': '头像样式的骨架。',
  'Skeleton.Input': '输入框样式的骨架。',
  'Skeleton.Image': '图片样式的骨架。',
  'Row': '栅格行，结合 Col 使用，用于页面布局。',
  'Col': '栅格列，必须嵌套在 Row 内使用，比例分配容器宽度。',
  'Flex': '弹性布局，用于控制子元素的对齐方式、间距、换行。',
  'Divider': '分割线，用于分隔段落或内容。',
};

interface ComponentItem {
  id: string;
  name: string;
  icon: React.ReactNode;
  description?: string;
  children: ComponentItem[];
}

interface ComponentGroup {
  id: string;
  name: string;
  items: ComponentItem[];
}

// 从契约的 icon 字段获取图标组件
function getIconFromContract(iconName?: string): React.ReactNode {
  if (!iconName) {
    return <Box size={18} strokeWidth={1.5} />;
  }
  const IconComponent = (LucideIcons as any)[iconName];
  if (!IconComponent) {
    return <Box size={18} strokeWidth={1.5} />;
  }
  return <IconComponent size={18} strokeWidth={1.5} />;
}

// 构建树形结构
function buildComponentTree(contracts: ComponentContract[]): ComponentItem[] {
  const treeMap = new Map<string, ComponentItem>();
  
  // 1. 先建立所有组件的节点
  contracts.forEach(c => {
    treeMap.set(c.componentType, {
      id: c.componentType,
      name: c.componentType.split('.').pop() || c.componentType,
      icon: getIconFromContract(c.icon),
      description: COMPONENT_METADATA[c.componentType] || (c as any).description,
      children: []
    });
  });

  const roots: ComponentItem[] = [];

  // 2. 建立父子关系
  treeMap.forEach((item, id) => {
    if (id.includes('.')) {
      const parentId = id.substring(0, id.lastIndexOf('.'));
      const parent = treeMap.get(parentId);
      if (parent) {
        parent.children.push(item);
      } else {
        roots.push(item);
      }
    } else {
      roots.push(item);
    }
  });

  return roots;
}

export interface ComponentPanelProps {
  contracts?: ComponentContract[];
  onInsert?: (componentType: string) => void;
}

function getCategoryName(category: string): string {
  const names: Record<string, string> = {
    'general': '通用',
    'layout': '布局',
    'navigation': '导航',
    'data-entry': '录入',
    'data-display': '展示',
    'feedback': '反馈',
    'other': '其他'
  };
  return names[category] || '未分类';
}

function UnifiedPopover({ 
  parent, 
  hoveredItem, 
  top, 
  left,
  onInsert, 
  onHoverItem, 
  onClose 
}: { 
  parent: ComponentItem, 
  hoveredItem: ComponentItem | null,
  top: number,
  left: number,
  onInsert: (id: string) => void,
  onHoverItem: (item: ComponentItem | null) => void,
  onClose: () => void
}) {
  const currentItem = hoveredItem || parent;

  return (
    <div 
      className="fixed z-50 flex flex-col w-[292px] group/popover pl-[8px] -ml-[8px]" // 8px bridge
      style={{ left: `${left}px`, top: `${top}px` }}
    >
      <div className="bg-bg-sidebar/95 backdrop-blur-xl border border-border-ide rounded-lg shadow-2xl dark:shadow-[0_16px_60px_rgba(0,0,0,0.6)] ring-1 ring-white/5 overflow-hidden flex flex-col w-full animate-in fade-in zoom-in slide-in-from-left-2 duration-200">
        {/* 上部分：子组件列表 (如果有子组件) */}
        {parent.children.length > 0 && (
          <div className="p-1 border-b border-border-ide/50 bg-bg-activity-bar/30">
            <div className="px-2 py-1 text-[11px] font-semibold text-text-secondary uppercase tracking-widest opacity-60 mb-1">
              Sub Components
            </div>
            <div className="grid grid-cols-1 gap-0.5">
              {parent.children.map(child => (
                <div
                  key={child.id}
                  onClick={(e) => { e.stopPropagation(); onInsert(child.id); }}
                  onMouseEnter={(e) => { e.stopPropagation(); onHoverItem(child); }}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-md cursor-pointer transition-colors text-[12px] group
                    ${hoveredItem?.id === child.id ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 font-medium' : 'hover:bg-text-primary/5 text-text-primary/80'}
                  `}
                >
                  <div className={`transition-colors ${hoveredItem?.id === child.id ? 'text-blue-500 dark:text-blue-400' : 'text-text-secondary group-hover:text-text-primary'}`}>
                    {child.icon}
                  </div>
                  <span className="truncate flex-1">{child.name}</span>
                  {hoveredItem?.id === child.id && <ChevronRight size={12} className="opacity-50" />}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 下部分：文档详情 */}
        <div className="p-4 bg-bg-sidebar">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-blue-500/10 dark:bg-blue-500/20 rounded-md text-blue-500 dark:text-blue-400">
              {currentItem.icon}
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-text-primary text-[14px] leading-none mb-1">{currentItem.id}</span>
              <span className="text-[11px] font-semibold text-text-secondary uppercase opacity-70">Documentation</span>
            </div>
          </div>
          <p className="text-text-secondary leading-relaxed text-[12px]">
            {currentItem.description || '暂无详细说明。'}
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * 基础文档气泡 (仅用于无子组件的组件)
 */
function StandaloneDocTooltip({ item, visible, top, left }: { item: ComponentItem | null, visible: boolean, top: number, left: number }) {
  if (!item || !visible) return null;
  
  return (
    <div className="fixed z-50 flex flex-col w-[288px] pl-[8px] -ml-[8px]" // 8px bridge
         style={{ left: `${left}px`, top: `${top}px` }}>
      <div className="bg-bg-sidebar/95 backdrop-blur-xl border border-border-ide rounded-lg shadow-2xl dark:shadow-[0_16px_60px_rgba(0,0,0,0.6)] ring-1 ring-white/5 p-4 w-full text-[12px] animate-in fade-in zoom-in duration-200">
        <div className="flex items-center gap-3 mb-3 pb-3 border-b border-border-ide/50">
          <div className="p-2 bg-blue-500/10 dark:bg-blue-500/20 rounded-md text-blue-500 dark:text-blue-400">
            {item.icon}
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-text-primary text-[14px] leading-none mb-1">{item.id}</span>
            <span className="text-[11px] font-semibold text-text-secondary uppercase opacity-70">Component Docs</span>
          </div>
        </div>
        <p className="text-text-secondary leading-relaxed text-[12px]">
          {item.description || '暂无详细说明。'}
        </p>
      </div>
    </div>
  );
}

export function ComponentPanel({ contracts = [], onInsert }: ComponentPanelProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeParent, setActiveParent] = useState<ComponentItem | null>(null);
  const [hoveredItem, setHoveredItem] = useState<ComponentItem | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ top: 0, left: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const closeTimeoutRef = useRef<number | null>(null);

  // 分组并构建树
  const groups: ComponentGroup[] = Object.entries(
    contracts.reduce<Record<string, ComponentContract[]>>((acc, c) => {
      const category = c.category ?? 'other';
      if (!acc[category]) acc[category] = [];
      acc[category].push(c);
      return acc;
    }, {})
  ).map(([category, items]) => ({
    id: category,
    name: getCategoryName(category),
    items: buildComponentTree(items)
  }));

  // 搜索过滤
  const filteredGroups = groups.map((group: ComponentGroup) => {
    const matchedItems = group.items.filter((item: ComponentItem) => {
      const lowerSearch = searchTerm.toLowerCase();
      const selfMatch = item.id.toLowerCase().includes(lowerSearch);
      const childMatch = item.children.some(child => child.id.toLowerCase().includes(lowerSearch));
      return selfMatch || childMatch;
    });
    return { ...group, items: matchedItems };
  }).filter(g => g.items.length > 0);

  const handleMouseEnter = (e: React.MouseEvent, item: ComponentItem) => {
    if (closeTimeoutRef.current) {
      window.clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
    setHoveredItem(item);
    setActiveParent(item);
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setTooltipPos({ 
      top: Math.max(20, Math.min(rect.top - 10, window.innerHeight - 250)),
      left: rect.right + 8
    });
  };

  const handleMouseLeave = () => {
    closeTimeoutRef.current = window.setTimeout(() => {
      setHoveredItem(null);
      setActiveParent(null);
    }, 150); // 150ms delay for smoother travel
  };

  const handlePopoverMouseEnter = () => {
    if (closeTimeoutRef.current) {
      window.clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
  };

  return (
    <div className="flex flex-col h-full bg-bg-sidebar text-text-primary select-none" ref={containerRef}>
      {/* 搜索框 */}
      <div className="p-2 border-b border-border-ide/50">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-[7px] text-text-secondary opacity-70" />
          <input
            type="text"
            placeholder="搜索组件..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-text-primary/[0.03] dark:bg-text-primary/[0.05] border border-transparent rounded-md pl-8 pr-2 py-1.5 text-[12px] text-text-primary focus:outline-none focus:bg-transparent focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 placeholder-text-secondary/60 transition-colors"
          />
        </div>
      </div>
      
      {/* 组件列表 */}
      <div className="flex-1 overflow-y-auto p-3 custom-scrollbar">
        {filteredGroups.map(group => (
          <div key={group.id} className="mb-6">
            <h3 className="text-[11px] font-semibold text-text-secondary uppercase tracking-wider mb-2 px-1 flex items-center gap-1.5 opacity-80">
              <span className="w-1 h-1 bg-text-secondary/40 rounded-full"></span>
              {group.name}
            </h3>
            
            <div className="grid grid-cols-[repeat(auto-fill,minmax(70px,1fr))] gap-1">
              {group.items.map(item => (
                <div
                  key={item.id}
                  className="relative"
                  onMouseEnter={(e) => handleMouseEnter(e, item)}
                  onMouseLeave={handleMouseLeave}
                >
                  <div
                    onClick={() => onInsert?.(item.id)}
                    className={`flex flex-col items-center justify-center h-[72px] w-full p-2 rounded-md cursor-pointer transition-colors active:scale-95 group/card
                      ${activeParent?.id === item.id ? 'bg-blue-500/10 text-blue-500' : 'bg-transparent border border-transparent hover:bg-text-primary/5'}
                    `}
                  >
                    <div className={`transition-colors mb-2 ${activeParent?.id === item.id ? 'text-blue-500' : 'text-text-secondary group-hover/card:text-text-primary'}`}>
                      {item.icon}
                    </div>
                    <span className={`text-[11px] text-center leading-tight truncate w-full px-0.5 transition-colors ${activeParent?.id === item.id ? 'text-blue-500 font-medium' : 'text-text-secondary group-hover/card:text-text-primary'}`}>
                      {item.name}
                    </span>

                    {item.children.length > 0 && (
                      <div className={`absolute bottom-1.5 right-1.5 w-0 h-0 border-t-[5px] border-t-transparent border-r-[5px] transition-colors
                        ${activeParent?.id === item.id ? 'border-r-blue-500' : 'border-r-text-secondary/30 group-hover/card:border-r-text-secondary/60'}
                      `}></div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        {filteredGroups.length === 0 && (
          <div className="flex flex-col items-center justify-center mt-20 text-text-secondary opacity-50">
            <Info size={32} strokeWidth={1} className="mb-2" />
            <span className="text-[12px]">未找到匹配组件</span>
          </div>
        )}
      </div>

      {/* 统一弹出面板 (用于带子组件的) */}
      {activeParent && activeParent.children.length > 0 && (
        <div onMouseEnter={handlePopoverMouseEnter} onMouseLeave={handleMouseLeave}>
          <UnifiedPopover 
            parent={activeParent}
            hoveredItem={hoveredItem}
            top={tooltipPos.top}
            left={tooltipPos.left}
            onInsert={(id) => onInsert?.(id)}
            onHoverItem={setHoveredItem}
            onClose={handleMouseLeave}
          />
        </div>
      )}

      {/* 独立文档气泡 (用于无子组件的) */}
      {activeParent && activeParent.children.length === 0 && (
        <div onMouseEnter={handlePopoverMouseEnter} onMouseLeave={handleMouseLeave}>
          <StandaloneDocTooltip 
            item={activeParent}
            visible={true}
            top={tooltipPos.top}
            left={tooltipPos.left}
          />
        </div>
      )}

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: var(--border-ide); border-radius: 10px; }
        .custom-scrollbar { scrollbar-width: thin; scrollbar-color: var(--border-ide) transparent; }
      `}</style>
    </div>
  );
}
