import React from 'react';
import {
  resolveActivityBarItems,
  type ActivityBarItemContribution,
} from './activitybar-items';
export type {
  ActivityBarItemContribution,
  ActivityBarItemIconProps,
  ActivityBarSection,
} from './activitybar-items';

interface ActivityItemProps {
  icon: ActivityBarItemContribution['icon'];
  active: boolean;
  label: string;
  onClick?: () => void;
}

const ActivityItem = ({ icon: Icon, active = false, label, onClick }: ActivityItemProps) => (
  <button
    type="button"
    aria-label={label}
    aria-pressed={active}
    data-active={active ? 'true' : 'false'}
    onClick={onClick}
    className={`
    w-full h-12 flex items-center justify-center cursor-pointer relative group
    ${active ? 'text-text-primary' : 'text-text-secondary hover:text-text-primary'}
  `}>
    {active && <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-primary" />}
    <Icon size={24} strokeWidth={1.5} />
    <div
      className="pointer-events-none absolute left-full ml-2 rounded border border-border-ide bg-bg-panel px-2 py-1 text-[11px] text-text-primary whitespace-nowrap opacity-0 shadow-md transition-opacity group-hover:opacity-100 z-30"
      role="tooltip"
    >
      {label}
    </div>
  </button>
);

export interface ActivityBarProps {
  items?: ActivityBarItemContribution[];
  activeItemId?: string;
  onSelectItem?: (item: ActivityBarItemContribution) => void;
}

export function ActivityBar({ items, activeItemId, onSelectItem }: ActivityBarProps) {
  const resolvedItems = React.useMemo(() => resolveActivityBarItems(items), [items]);
  const mainItems = resolvedItems.filter((item) => (item.section ?? 'main') === 'main');
  const bottomItems = resolvedItems.filter((item) => (item.section ?? 'main') === 'bottom');

  const defaultActiveId = React.useMemo(() => {
    const preferred = resolvedItems.find((item) => item.active)?.id;
    return preferred ?? resolvedItems[0]?.id ?? '';
  }, [resolvedItems]);

  const [innerActiveId, setInnerActiveId] = React.useState(defaultActiveId);
  const activeId = activeItemId ?? innerActiveId;

  const setActiveId = React.useCallback((nextId: string) => {
    if (activeItemId === undefined) {
      setInnerActiveId(nextId);
    }
  }, [activeItemId]);

  React.useEffect(() => {
    if (!activeId) {
      setInnerActiveId(defaultActiveId);
      return;
    }
    const exists = resolvedItems.some((item) => item.id === activeId);
    if (!exists) {
      setInnerActiveId(defaultActiveId);
    }
  }, [activeId, defaultActiveId, resolvedItems]);

  return (
    <div className="w-12 h-full bg-bg-activity-bar border-r border-border-ide flex flex-col justify-between items-center py-2 shrink-0">
      <div className="w-full flex flex-col items-center">
        {mainItems.map((item) => (
          <ActivityItem
            key={item.id}
            icon={item.icon}
            active={activeId === item.id}
            label={item.label}
            onClick={() => {
              setActiveId(item.id);
              item.onClick?.();
              onSelectItem?.(item);
            }}
          />
        ))}
      </div>
      <div className="w-full flex flex-col items-center">
        {bottomItems.map((item) => (
          <ActivityItem
            key={item.id}
            icon={item.icon}
            active={activeId === item.id}
            label={item.label}
            onClick={() => {
              setActiveId(item.id);
              item.onClick?.();
              onSelectItem?.(item);
            }}
          />
        ))}
      </div>
    </div>
  );
}
