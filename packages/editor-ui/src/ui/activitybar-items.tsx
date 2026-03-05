import type React from 'react';
import {
  BugPlay,
  Database,
  FileText,
  Package,
  Search,
  Settings,
} from 'lucide-react';

export type ActivityBarSection = 'main' | 'bottom';

export interface ActivityBarItemIconProps {
  size?: number;
  strokeWidth?: number;
  className?: string;
}

export interface ActivityBarItemContribution {
  id: string;
  label: string;
  icon: React.ComponentType<ActivityBarItemIconProps>;
  order?: number;
  active?: boolean;
  section?: ActivityBarSection;
  targetSidebarTabId?: string;
  onClick?: () => void;
}

function createBuiltinActivityItems(): ActivityBarItemContribution[] {
  return [
    { id: 'explorer', label: 'Explorer', icon: FileText, order: 10, active: true, section: 'main', targetSidebarTabId: 'components' },
    { id: 'search', label: 'Search', icon: Search, order: 20, section: 'main', targetSidebarTabId: 'outline' },
    { id: 'data', label: 'Data', icon: Database, order: 30, section: 'main', targetSidebarTabId: 'data' },
    { id: 'debug', label: 'Debug', icon: BugPlay, order: 40, section: 'main' },
    { id: 'extensions', label: 'Extensions', icon: Package, order: 50, section: 'main' },
    { id: 'settings', label: 'Settings', icon: Settings, order: 10, section: 'bottom' },
  ];
}

export function resolveActivityBarItems(
  extensions?: ActivityBarItemContribution[],
): ActivityBarItemContribution[] {
  const merged = new Map<string, ActivityBarItemContribution>();
  for (const item of createBuiltinActivityItems()) {
    merged.set(item.id, item);
  }
  for (const item of extensions ?? []) {
    merged.set(item.id, item);
  }
  return [...merged.values()].sort((left, right) => (left.order ?? 0) - (right.order ?? 0));
}
