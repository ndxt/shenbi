import React, { useEffect, useRef, useState } from 'react';
import {
  Box,
  ChevronRight,
  Info,
  Search,
} from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { useTranslation } from '@shenbi/i18n';
import {
  buildPaletteGroupsFromAssetGroups,
  type PaletteAssetGroup,
  type PaletteAssetInsertKind,
  type PaletteDragPayload,
  type PaletteGroup,
  type PaletteItem,
} from './palette-model';
export type {
  PaletteAsset,
  PaletteAssetGroup,
  PaletteAssetInsertKind,
  PaletteAssetVisibility,
  PaletteDragPayload,
  PaletteGroup,
  PaletteItem,
} from './palette-model';

const PALETTE_DRAG_MIME = 'application/x-shenbi-palette-item';

type LucideIconName = keyof typeof LucideIcons;

export interface PalettePanelProps {
  groups?: PaletteGroup[] | undefined;
  assetGroups?: PaletteAssetGroup[] | undefined;
  layout?: 'grid' | 'list' | undefined;
  insertKind?: PaletteAssetInsertKind | undefined;
  searchPlaceholder?: string | undefined;
  emptyText?: string | undefined;
  showGroupHeaders?: boolean | undefined;
  variant?: 'sidebar' | 'overlay' | undefined;
  dragEnabled?: boolean | undefined;
  onInsert?: ((payload: PaletteDragPayload, item: PaletteItem) => void) | undefined;
  onStartDrag?: ((payload: PaletteDragPayload, item: PaletteItem) => void) | undefined;
  onEndDrag?: (() => void) | undefined;
}

export function beginPaletteDrag(
  event: React.DragEvent<HTMLElement>,
  payload: PaletteDragPayload,
): void {
  event.dataTransfer.effectAllowed = 'copy';
  event.dataTransfer.setData('text/plain', payload.type);
  event.dataTransfer.setData(PALETTE_DRAG_MIME, JSON.stringify(payload));
}

export function readPaletteDragPayload(dataTransfer: DataTransfer | null): PaletteDragPayload | null {
  if (!dataTransfer) {
    return null;
  }
  const raw = dataTransfer.getData(PALETTE_DRAG_MIME);
  if (!raw) {
    return null;
  }
  try {
    const payload = JSON.parse(raw) as PaletteDragPayload;
    if (!payload || (payload.kind !== 'component' && payload.kind !== 'gateway-node')) {
      return null;
    }
    if (typeof payload.type !== 'string' || payload.type.length === 0) {
      return null;
    }
    if (typeof payload.label !== 'string' || payload.label.length === 0) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

function renderPaletteIcon(iconName?: string, size = 18): React.ReactNode {
  if (!iconName) {
    return <Box size={size} strokeWidth={1.5} />;
  }
  const IconComponent = (LucideIcons as unknown as Record<string, React.ComponentType<{ size?: number; strokeWidth?: number }>>)[iconName as LucideIconName];
  if (!IconComponent) {
    return <Box size={size} strokeWidth={1.5} />;
  }
  return <IconComponent size={size} strokeWidth={1.5} />;
}

function getItemColor(item: PaletteItem): string | undefined {
  const color = item.color ?? item.dragPayload.meta?.color;
  return typeof color === 'string' ? color : undefined;
}

function canInsertItem(item: PaletteItem): boolean {
  return item.insertable !== false;
}

function PalettePopover({
  parent,
  hoveredItem,
  top,
  left,
  onInsert,
  onStartDrag,
  onEndDrag,
  dragEnabled,
  onHoverItem,
}: {
  parent: PaletteItem;
  hoveredItem: PaletteItem | null;
  top: number;
  left: number;
  onInsert?: ((payload: PaletteDragPayload, item: PaletteItem) => void) | undefined;
  onStartDrag?: ((payload: PaletteDragPayload, item: PaletteItem) => void) | undefined;
  onEndDrag?: (() => void) | undefined;
  dragEnabled: boolean;
  onHoverItem: (item: PaletteItem | null) => void;
}) {
  const { t } = useTranslation('editorUi');
  const currentItem = hoveredItem ?? parent;

  return (
    <div
      className="fixed z-[120] flex flex-col w-[292px] group/popover pl-[8px] -ml-[8px]"
      style={{ left: `${left}px`, top: `${top}px` }}
    >
      <div className="bg-bg-sidebar/95 backdrop-blur-xl border border-border-ide rounded-lg shadow-2xl dark:shadow-[0_16px_60px_rgba(0,0,0,0.6)] ring-1 ring-white/5 overflow-hidden flex flex-col w-full animate-in fade-in zoom-in slide-in-from-left-2 duration-200">
        {parent.children && parent.children.length > 0 ? (
          <div className="p-1 border-b border-border-ide/50 bg-bg-activity-bar/30">
            <div className="px-2 py-1 text-[11px] font-semibold text-text-secondary uppercase tracking-widest opacity-60 mb-1">
              {t('popover.subComponents')}
            </div>
            <div className="grid grid-cols-1 gap-0.5">
              {parent.children.map((child) => (
                <div
                  key={child.id}
                  draggable={dragEnabled && child.draggable !== false}
                  onDragStart={(event) => {
                    if (!dragEnabled || child.draggable === false) {
                      event.preventDefault();
                      return;
                    }
                    beginPaletteDrag(event, child.dragPayload);
                    onStartDrag?.(child.dragPayload, child);
                  }}
                  onDragEnd={() => {
                    onEndDrag?.();
                  }}
                  onClick={(event) => {
                    event.stopPropagation();
                    if (canInsertItem(child)) {
                      onInsert?.(child.dragPayload, child);
                    }
                  }}
                  onMouseEnter={(event) => {
                    event.stopPropagation();
                    onHoverItem(child);
                  }}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-md cursor-pointer transition-colors text-[12px] group ${
                    hoveredItem?.id === child.id
                      ? 'bg-primary/10 text-primary dark:text-primary font-medium'
                      : 'hover:bg-text-primary/5 text-text-primary/80'
                  }`}
                >
                  <div
                    className={`transition-colors ${
                      hoveredItem?.id === child.id
                        ? 'text-primary dark:text-primary'
                        : 'text-text-secondary group-hover:text-text-primary'
                    }`}
                  >
                    {renderPaletteIcon(child.icon)}
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
            <div className="p-2 bg-primary/10 dark:bg-primary/20 rounded-md text-primary dark:text-primary">
              {renderPaletteIcon(currentItem.icon)}
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

function PaletteDocTooltip({
  item,
  visible,
  top,
  left,
}: {
  item: PaletteItem | null;
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
      className="fixed z-[120] flex flex-col w-[288px] pl-[8px] -ml-[8px]"
      style={{ left: `${left}px`, top: `${top}px` }}
    >
      <div className="bg-bg-sidebar/95 backdrop-blur-xl border border-border-ide rounded-lg shadow-2xl dark:shadow-[0_16px_60px_rgba(0,0,0,0.6)] ring-1 ring-white/5 p-4 w-full text-[12px] animate-in fade-in zoom-in duration-200">
        <div className="flex items-center gap-3 mb-3 pb-3 border-b border-border-ide/50">
          <div className="p-2 bg-primary/10 dark:bg-primary/20 rounded-md text-primary dark:text-primary">
            {renderPaletteIcon(item.icon)}
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

function GridPaletteItem({
  item,
  active,
  onInsert,
  onStartDrag,
  onEndDrag,
  dragEnabled,
  onMouseEnter,
  onMouseLeave,
}: {
  item: PaletteItem;
  active: boolean;
  onInsert?: ((payload: PaletteDragPayload, item: PaletteItem) => void) | undefined;
  onStartDrag?: ((payload: PaletteDragPayload, item: PaletteItem) => void) | undefined;
  onEndDrag?: (() => void) | undefined;
  dragEnabled: boolean;
  onMouseEnter: (event: React.MouseEvent, item: PaletteItem) => void;
  onMouseLeave: () => void;
}) {
  return (
    <div
      className="relative"
      onMouseEnter={(event) => onMouseEnter(event, item)}
      onMouseLeave={onMouseLeave}
    >
      <div
        draggable={dragEnabled && item.draggable !== false}
        onDragStart={(event) => {
          if (!dragEnabled || item.draggable === false) {
            event.preventDefault();
            return;
          }
          beginPaletteDrag(event, item.dragPayload);
          onStartDrag?.(item.dragPayload, item);
        }}
        onDragEnd={() => {
          onEndDrag?.();
        }}
        onClick={() => {
          if (canInsertItem(item)) {
            onInsert?.(item.dragPayload, item);
          }
        }}
        className={`flex flex-col items-center justify-center h-full min-h-[72px] w-full p-2 rounded-md transition-colors group/card ${
          active
            ? 'bg-primary/10 text-primary'
            : 'bg-transparent border border-transparent hover:bg-text-primary/5'
        } ${canInsertItem(item) ? 'cursor-pointer active:scale-95' : 'cursor-default'}`}
      >
        <div
          className={`transition-colors mb-2 ${
            active
              ? 'text-primary'
              : 'text-text-secondary group-hover/card:text-text-primary'
          }`}
        >
          {renderPaletteIcon(item.icon)}
        </div>
        <span
          className={`text-[11px] text-center leading-tight line-clamp-2 break-words w-full px-0.5 transition-colors ${
            active
              ? 'text-primary font-medium'
              : 'text-text-secondary group-hover/card:text-text-primary'
          }`}
        >
          {item.name}
        </span>

        {item.children && item.children.length > 0 ? (
          <div
            className={`absolute bottom-1.5 right-1.5 w-0 h-0 border-t-[5px] border-t-transparent border-r-[5px] transition-colors ${
              active
                ? 'border-r-primary'
                : 'border-r-text-secondary/30 group-hover/card:border-r-text-secondary/60'
            }`}
          />
        ) : null}
      </div>
    </div>
  );
}

function ListPaletteItem({
  item,
  onInsert,
  onStartDrag,
  onEndDrag,
  dragEnabled,
}: {
  item: PaletteItem;
  onInsert?: ((payload: PaletteDragPayload, item: PaletteItem) => void) | undefined;
  onStartDrag?: ((payload: PaletteDragPayload, item: PaletteItem) => void) | undefined;
  onEndDrag?: (() => void) | undefined;
  dragEnabled: boolean;
}) {
  const iconBg = getItemColor(item) ?? 'var(--color-primary-bg)';

  return (
    <div
      draggable={dragEnabled && item.draggable !== false}
      onDragStart={(event) => {
        if (!dragEnabled || item.draggable === false) {
          event.preventDefault();
          return;
        }
        beginPaletteDrag(event, item.dragPayload);
        onStartDrag?.(item.dragPayload, item);
      }}
      onDragEnd={() => {
        onEndDrag?.();
      }}
      onClick={() => {
        if (canInsertItem(item)) {
          onInsert?.(item.dragPayload, item);
        }
      }}
      className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors border border-transparent hover:border-border-ide/50 hover:bg-text-primary/5 ${
        canInsertItem(item) ? 'cursor-pointer active:scale-[0.99]' : 'cursor-default'
      }`}
    >
      <div
        className="flex items-center justify-center w-9 h-9 rounded-lg shrink-0 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]"
        style={{ backgroundColor: iconBg }}
      >
        {renderPaletteIcon(item.icon, 16)}
      </div>
      <div className="min-w-0 flex-1 flex flex-col gap-0.5">
        <span className="text-[13px] font-medium text-text-primary truncate">{item.name}</span>
        <span className="text-[11px] text-text-secondary truncate">
          {item.description}
        </span>
      </div>
    </div>
  );
}

export function PalettePanel({
  groups,
  assetGroups,
  layout = 'grid',
  insertKind = 'sidebar',
  searchPlaceholder,
  emptyText,
  showGroupHeaders = true,
  variant = 'sidebar',
  dragEnabled = true,
  onInsert,
  onStartDrag,
  onEndDrag,
}: PalettePanelProps) {
  const { t } = useTranslation('editorUi');
  const [searchTerm, setSearchTerm] = useState('');
  const [activeParent, setActiveParent] = useState<PaletteItem | null>(null);
  const [hoveredItem, setHoveredItem] = useState<PaletteItem | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ top: 0, left: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const closeTimeoutRef = useRef<number | null>(null);
  const resolvedGroups = assetGroups
    ? buildPaletteGroupsFromAssetGroups(assetGroups, insertKind)
    : (groups ?? []);

  const filteredGroups = resolvedGroups
    .map((group) => {
      const matchedItems = group.items.filter((item) => {
        const lowerSearch = searchTerm.toLowerCase();
        if (!lowerSearch) {
          return true;
        }
        const selfMatch = item.id.toLowerCase().includes(lowerSearch)
          || item.name.toLowerCase().includes(lowerSearch)
          || (item.description?.toLowerCase().includes(lowerSearch) ?? false);
        const childMatch = item.children?.some((child) => (
          child.id.toLowerCase().includes(lowerSearch)
          || child.name.toLowerCase().includes(lowerSearch)
          || (child.description?.toLowerCase().includes(lowerSearch) ?? false)
        )) ?? false;
        return selfMatch || childMatch;
      });
      return { ...group, items: matchedItems };
    })
    .filter((group) => group.items.length > 0);

  const handleMouseEnter = (event: React.MouseEvent, item: PaletteItem) => {
    if (layout !== 'grid') {
      return;
    }
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
    if (layout !== 'grid') {
      return;
    }
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
    <div
      className={`flex flex-col h-full bg-bg-sidebar text-text-primary select-none ${
        variant === 'overlay'
          ? 'border border-border-ide rounded-xl shadow-2xl overflow-hidden'
          : ''
      }`}
      ref={containerRef}
    >
      <div className="p-2 border-b border-border-ide/50">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-[7px] text-text-secondary opacity-70" />
          <input
            type="text"
            placeholder={searchPlaceholder ?? t('search.placeholder')}
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            className="w-full bg-text-primary/[0.03] dark:bg-text-primary/[0.05] border border-transparent rounded-md pl-8 pr-2 py-1.5 text-[12px] text-text-primary focus:outline-none focus:bg-transparent focus:border-primary/50 focus:ring-1 focus:ring-primary/20 placeholder-text-secondary/60 transition-colors"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 custom-scrollbar">
        {filteredGroups.map((group) => (
          <div key={group.id} className="mb-6 last:mb-0">
            {showGroupHeaders ? (
              <h3 className="text-[11px] font-semibold text-text-secondary uppercase tracking-wider mb-2 px-1 flex items-center gap-1.5 opacity-80">
                <span className="w-1 h-1 bg-text-secondary/40 rounded-full" />
                {group.name}
              </h3>
            ) : null}

            <div className={layout === 'grid' ? 'grid grid-cols-[repeat(auto-fill,minmax(70px,1fr))] gap-1' : 'flex flex-col gap-1.5'}>
              {group.items.map((item) => (
                layout === 'grid' ? (
                  <GridPaletteItem
                    key={item.id}
                    item={item}
                    active={activeParent?.id === item.id}
                    onInsert={onInsert}
                    onStartDrag={onStartDrag}
                    onEndDrag={onEndDrag}
                    dragEnabled={dragEnabled}
                    onMouseEnter={handleMouseEnter}
                    onMouseLeave={handleMouseLeave}
                  />
                ) : (
                  <ListPaletteItem
                    key={item.id}
                    item={item}
                    onInsert={onInsert}
                    onStartDrag={onStartDrag}
                    onEndDrag={onEndDrag}
                    dragEnabled={dragEnabled}
                  />
                )
              ))}
            </div>
          </div>
        ))}

        {filteredGroups.length === 0 ? (
          <div className="flex flex-col items-center justify-center mt-20 text-text-secondary opacity-50">
            <Info size={32} strokeWidth={1} className="mb-2" />
            <span className="text-[12px]">{emptyText ?? t('notFound', { ns: 'common' })}</span>
          </div>
        ) : null}
      </div>

      {layout === 'grid' && activeParent && activeParent.children && activeParent.children.length > 0 ? (
        <div onMouseEnter={handlePopoverMouseEnter} onMouseLeave={handleMouseLeave}>
          <PalettePopover
            parent={activeParent}
            hoveredItem={hoveredItem}
            top={tooltipPos.top}
            left={tooltipPos.left}
            onInsert={onInsert}
            onStartDrag={onStartDrag}
            onEndDrag={onEndDrag}
            dragEnabled={dragEnabled}
            onHoverItem={setHoveredItem}
          />
        </div>
      ) : null}

      {layout === 'grid' && activeParent && (!activeParent.children || activeParent.children.length === 0) ? (
        <div onMouseEnter={handlePopoverMouseEnter} onMouseLeave={handleMouseLeave}>
          <PaletteDocTooltip
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
