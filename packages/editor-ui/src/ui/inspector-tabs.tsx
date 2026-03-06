import {
  mergeContributions,
  type InspectorTabContribution,
  type InspectorTabRenderContext,
} from '@shenbi/editor-plugin-api';

export type { InspectorTabContribution, InspectorTabRenderContext } from '@shenbi/editor-plugin-api';

export function resolveInspectorTabs(
  extensions?: InspectorTabContribution[],
): InspectorTabContribution[] {
  return mergeContributions([], extensions);
}
