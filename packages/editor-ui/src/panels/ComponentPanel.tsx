import React, { useEffect, useRef, useState } from 'react';
import {
  Box,
  ChevronRight,
  Info,
  Search,
} from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import type { ComponentContract } from '@shenbi/schema';
import { useTranslation } from '@shenbi/i18n';

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

interface ComponentItem {
  id: string;
  name: string;
  icon: React.ReactNode;
  description: string | undefined;
  children: ComponentItem[];
}

interface ComponentGroup {
  id: string;
  name: string;
  items: ComponentItem[];
}

type TranslateFn = (key: string, ...args: any[]) => string;

function getIconFromContract(iconName?: string): React.ReactNode {
  if (!iconName) {
    return <Box size={18} strokeWidth={1.5} />;
  }
  const IconComponent = (LucideIcons as unknown as Record<string, React.ComponentType<any>>)[iconName];
  if (!IconComponent) {
    return <Box size={18} strokeWidth={1.5} />;
  }
  return <IconComponent size={18} strokeWidth={1.5} />;
}

function buildComponentTree(
  contracts: ComponentContract[],
  t: TranslateFn,
): ComponentItem[] {
  const treeMap = new Map<string, ComponentItem>();

  contracts.forEach((contract) => {
    const descriptionKey = COMPONENT_DESCRIPTION_KEYS[contract.componentType];
    treeMap.set(contract.componentType, {
      id: contract.componentType,
      name: contract.componentType.split('.').pop() || contract.componentType,
      icon: getIconFromContract(contract.icon),
      description: descriptionKey
        ? t(descriptionKey, { defaultValue: (contract as { description?: string }).description })
        : (contract as { description?: string }).description,
      children: [],
    });
  });

  const roots: ComponentItem[] = [];

  treeMap.forEach((item, id) => {
    if (id.includes('.')) {
      const parentId = id.substring(0, id.lastIndexOf('.'));
      const parent = treeMap.get(parentId);
      if (parent) {
        parent.children.push(item);
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
}

function getCategoryName(category: string, t: TranslateFn): string {
  const names: Record<string, string> = {
    'general': t('category.general'),
    'layout': t('category.layout'),
    'navigation': t('category.navigation'),
    'data-entry': t('category.dataEntry'),
    'data-display': t('category.dataDisplay'),
    'feedback': t('category.feedback'),
    'other': t('category.other'),
  };
  return names[category] || t('category.uncategorized');
}

function UnifiedPopover({
  parent,
  hoveredItem,
  top,
  left,
  onInsert,
  onHoverItem,
}: {
  parent: ComponentItem;
  hoveredItem: ComponentItem | null;
  top: number;
  left: number;
  onInsert: (id: string) => void;
  onHoverItem: (item: ComponentItem | null) => void;
}) {
  const { t } = useTranslation('editorUi');
  const currentItem = hoveredItem || parent;

  return (
    <div
      className="fixed z-50 flex flex-col w-[292px] group/popover pl-[8px] -ml-[8px]"
      style={{ left: `${left}px`, top: `${top}px` }}
    >
      <div className="bg-bg-sidebar/95 backdrop-blur-xl border border-border-ide rounded-lg shadow-2xl dark:shadow-[0_16px_60px_rgba(0,0,0,0.6)] ring-1 ring-white/5 overflow-hidden flex flex-col w-full animate-in fade-in zoom-in slide-in-from-left-2 duration-200">
        {parent.children.length > 0 ? (
          <div className="p-1 border-b border-border-ide/50 bg-bg-activity-bar/30">
            <div className="px-2 py-1 text-[11px] font-semibold text-text-secondary uppercase tracking-widest opacity-60 mb-1">
              {t('popover.subComponents')}
            </div>
            <div className="grid grid-cols-1 gap-0.5">
              {parent.children.map((child) => (
                <div
                  key={child.id}
                  onClick={(event) => {
                    event.stopPropagation();
                    onInsert(child.id);
                  }}
                  onMouseEnter={(event) => {
                    event.stopPropagation();
                    onHoverItem(child);
                  }}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-md cursor-pointer transition-colors text-[12px] group ${
                    hoveredItem?.id === child.id
                      ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 font-medium'
                      : 'hover:bg-text-primary/5 text-text-primary/80'
                  }`}
                >
                  <div className={`transition-colors ${
                    hoveredItem?.id === child.id
                      ? 'text-blue-500 dark:text-blue-400'
                      : 'text-text-secondary group-hover:text-text-primary'
                  }`}
                  >
                    {child.icon}
                  </div>
                  <span className="truncate flex-1">{child.name}</span>
                  {hoveredItem?.id === child.id ? <ChevronRight size={12} className="opacity-50" /> : null}
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div className="p-4 bg-bg-sidebar">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-blue-500/10 dark:bg-blue-500/20 rounded-md text-blue-500 dark:text-blue-400">
              {currentItem.icon}
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-text-primary text-[14px] leading-none mb-1">{currentItem.id}</span>
              <span className="text-[11px] font-semibold text-text-secondary uppercase opacity-70">
                {t('popover.documentation')}
              </span>
            </div>
          </div>
          <p className="text-text-secondary leading-relaxed text-[12px]">
            {currentItem.description || t('noDescription', { ns: 'common' })}
          </p>
        </div>
      </div>
    </div>
  );
}

function StandaloneDocTooltip({
  item,
  visible,
  top,
  left,
}: {
  item: ComponentItem | null;
  visible: boolean;
  top: number;
  left: number;
}) {
  const { t } = useTranslation('editorUi');

  if (!item || !visible) {
    return null;
  }

  return (
    <div
      className="fixed z-50 flex flex-col w-[288px] pl-[8px] -ml-[8px]"
      style={{ left: `${left}px`, top: `${top}px` }}
    >
      <div className="bg-bg-sidebar/95 backdrop-blur-xl border border-border-ide rounded-lg shadow-2xl dark:shadow-[0_16px_60px_rgba(0,0,0,0.6)] ring-1 ring-white/5 p-4 w-full text-[12px] animate-in fade-in zoom-in duration-200">
        <div className="flex items-center gap-3 mb-3 pb-3 border-b border-border-ide/50">
          <div className="p-2 bg-blue-500/10 dark:bg-blue-500/20 rounded-md text-blue-500 dark:text-blue-400">
            {item.icon}
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-text-primary text-[14px] leading-none mb-1">{item.id}</span>
            <span className="text-[11px] font-semibold text-text-secondary uppercase opacity-70">
              {t('popover.componentDocs')}
            </span>
          </div>
        </div>
        <p className="text-text-secondary leading-relaxed text-[12px]">
          {item.description || t('noDescription', { ns: 'common' })}
        </p>
      </div>
    </div>
  );
}

export function ComponentPanel({ contracts = [], onInsert }: ComponentPanelProps) {
  const { t } = useTranslation('editorUi');
  const [searchTerm, setSearchTerm] = useState('');
  const [activeParent, setActiveParent] = useState<ComponentItem | null>(null);
  const [hoveredItem, setHoveredItem] = useState<ComponentItem | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ top: 0, left: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const closeTimeoutRef = useRef<number | null>(null);

  const groups: ComponentGroup[] = Object.entries(
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

  const filteredGroups = groups
    .map((group) => {
      const matchedItems = group.items.filter((item) => {
        const lowerSearch = searchTerm.toLowerCase();
        const selfMatch = item.id.toLowerCase().includes(lowerSearch);
        const childMatch = item.children.some((child) => child.id.toLowerCase().includes(lowerSearch));
        return selfMatch || childMatch;
      });
      return { ...group, items: matchedItems };
    })
    .filter((group) => group.items.length > 0);

  const handleMouseEnter = (event: React.MouseEvent, item: ComponentItem) => {
    if (closeTimeoutRef.current) {
      window.clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
    setHoveredItem(item);
    setActiveParent(item);
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    setTooltipPos({
      top: Math.max(20, Math.min(rect.top - 10, window.innerHeight - 250)),
      left: rect.right + 8,
    });
  };

  const handleMouseLeave = () => {
    closeTimeoutRef.current = window.setTimeout(() => {
      setHoveredItem(null);
      setActiveParent(null);
    }, 150);
  };

  const handlePopoverMouseEnter = () => {
    if (closeTimeoutRef.current) {
      window.clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current) {
        window.clearTimeout(closeTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div className="flex flex-col h-full bg-bg-sidebar text-text-primary select-none" ref={containerRef}>
      <div className="p-2 border-b border-border-ide/50">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-[7px] text-text-secondary opacity-70" />
          <input
            type="text"
            placeholder={t('search.placeholder')}
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            className="w-full bg-text-primary/[0.03] dark:bg-text-primary/[0.05] border border-transparent rounded-md pl-8 pr-2 py-1.5 text-[12px] text-text-primary focus:outline-none focus:bg-transparent focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 placeholder-text-secondary/60 transition-colors"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 custom-scrollbar">
        {filteredGroups.map((group) => (
          <div key={group.id} className="mb-6">
            <h3 className="text-[11px] font-semibold text-text-secondary uppercase tracking-wider mb-2 px-1 flex items-center gap-1.5 opacity-80">
              <span className="w-1 h-1 bg-text-secondary/40 rounded-full" />
              {group.name}
            </h3>

            <div className="grid grid-cols-[repeat(auto-fill,minmax(70px,1fr))] gap-1">
              {group.items.map((item) => (
                <div
                  key={item.id}
                  className="relative"
                  onMouseEnter={(event) => handleMouseEnter(event, item)}
                  onMouseLeave={handleMouseLeave}
                >
                  <div
                    onClick={() => onInsert?.(item.id)}
                    className={`flex flex-col items-center justify-center h-[72px] w-full p-2 rounded-md cursor-pointer transition-colors active:scale-95 group/card ${
                      activeParent?.id === item.id
                        ? 'bg-blue-500/10 text-blue-500'
                        : 'bg-transparent border border-transparent hover:bg-text-primary/5'
                    }`}
                  >
                    <div className={`transition-colors mb-2 ${
                      activeParent?.id === item.id
                        ? 'text-blue-500'
                        : 'text-text-secondary group-hover/card:text-text-primary'
                    }`}
                    >
                      {item.icon}
                    </div>
                    <span className={`text-[11px] text-center leading-tight truncate w-full px-0.5 transition-colors ${
                      activeParent?.id === item.id
                        ? 'text-blue-500 font-medium'
                        : 'text-text-secondary group-hover/card:text-text-primary'
                    }`}
                    >
                      {item.name}
                    </span>

                    {item.children.length > 0 ? (
                      <div className={`absolute bottom-1.5 right-1.5 w-0 h-0 border-t-[5px] border-t-transparent border-r-[5px] transition-colors ${
                        activeParent?.id === item.id
                          ? 'border-r-blue-500'
                          : 'border-r-text-secondary/30 group-hover/card:border-r-text-secondary/60'
                      }`}
                      />
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        {filteredGroups.length === 0 ? (
          <div className="flex flex-col items-center justify-center mt-20 text-text-secondary opacity-50">
            <Info size={32} strokeWidth={1} className="mb-2" />
            <span className="text-[12px]">{t('notFound', { ns: 'common' })}</span>
          </div>
        ) : null}
      </div>

      {activeParent && activeParent.children.length > 0 ? (
        <div onMouseEnter={handlePopoverMouseEnter} onMouseLeave={handleMouseLeave}>
          <UnifiedPopover
            parent={activeParent}
            hoveredItem={hoveredItem}
            top={tooltipPos.top}
            left={tooltipPos.left}
            onInsert={(id) => onInsert?.(id)}
            onHoverItem={setHoveredItem}
          />
        </div>
      ) : null}

      {activeParent && activeParent.children.length === 0 ? (
        <div onMouseEnter={handlePopoverMouseEnter} onMouseLeave={handleMouseLeave}>
          <StandaloneDocTooltip
            item={activeParent}
            visible
            top={tooltipPos.top}
            left={tooltipPos.left}
          />
        </div>
      ) : null}

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: var(--border-ide); border-radius: 10px; }
        .custom-scrollbar { scrollbar-width: thin; scrollbar-color: var(--border-ide) transparent; }
      `}</style>
    </div>
  );
}
