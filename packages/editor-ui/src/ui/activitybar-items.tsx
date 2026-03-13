import {
  BugPlay,
  Database,
  LayoutGrid,
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
    { id: 'explorer', label: 'Components', icon: LayoutGrid, order: 10, active: true, section: 'main', target: { type: 'panel', panelId: 'explorer' } },
    { id: 'search', label: 'Outline', icon: Search, order: 20, section: 'main', target: { type: 'panel', panelId: 'search' } },
    { id: 'data', label: 'Data', icon: Database, order: 30, section: 'main', target: { type: 'panel', panelId: 'data' } },
    { id: 'debug', label: 'Debug', icon: BugPlay, order: 40, section: 'main', target: { type: 'action' } },
    { id: 'extensions', label: 'Extensions', icon: Package, order: 50, section: 'main', target: { type: 'action' } },
    { id: 'settings', label: 'Settings', icon: Settings, order: 10, section: 'bottom', target: { type: 'action' } },
  ];
}

export function resolveActivityBarItems(
  extensions?: ActivityBarItemContribution[],
): ActivityBarItemContribution[] {
  return mergeContributions(createBuiltinActivityItems(), extensions);
}
