import {
  BugPlay,
  Database,
  Package,
  Search,
  Settings,
} from 'lucide-react';
import { i18n } from '@shenbi/i18n';
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
    { id: 'search', label: i18n.t('workbench.outline', { ns: 'editorUi' }), icon: Search, order: 20, active: true, section: 'main', target: { type: 'action' } },
    { id: 'data', label: i18n.t('workbench.data', { ns: 'editorUi' }), icon: Database, order: 30, section: 'main', target: { type: 'action' } },
    { id: 'debug', label: i18n.t('workbench.debug', { ns: 'editorUi' }), icon: BugPlay, order: 40, section: 'main', target: { type: 'action' } },
    { id: 'extensions', label: i18n.t('workbench.extensions', { ns: 'editorUi' }), icon: Package, order: 50, section: 'main', target: { type: 'action' } },
    { id: 'settings', label: i18n.t('workbench.settings', { ns: 'editorUi' }), icon: Settings, order: 10, section: 'bottom', target: { type: 'action' } },
  ];
}

export function resolveActivityBarItems(
  extensions?: ActivityBarItemContribution[],
): ActivityBarItemContribution[] {
  return mergeContributions(createBuiltinActivityItems(), extensions);
}
