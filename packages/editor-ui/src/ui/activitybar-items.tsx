import {
  BugPlay,
  Database,
  FileText,
  Package,
  Search,
  Settings,
} from 'lucide-react';
import {
  mergeContributions,
  type ActivityBarItemContribution,
} from '@shenbi/editor-plugin-api';

export type {
  ActivityBarItemContribution,
  ActivityBarItemIconProps,
  ActivityBarSection,
} from '@shenbi/editor-plugin-api';

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
  return mergeContributions(createBuiltinActivityItems(), extensions);
}
