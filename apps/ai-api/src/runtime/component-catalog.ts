import type { ZoneType } from '@shenbi/ai-agents';
import type { ComponentContract } from '@shenbi/schema';
import * as schemaContractsModule from '../../../../packages/schema/contracts/index.ts';

type ComponentGroupName =
  | 'layout-shell'
  | 'typography'
  | 'actions'
  | 'filters-form'
  | 'feedback-status'
  | 'data-display';

interface ComponentGroupDefinition {
  name: ComponentGroupName;
  description: string;
  components: string[];
}

interface CompiledComponentSummary {
  componentType: string;
  category: string;
  childrenType: string;
  propSummary: string[];
  eventSummary: string[];
}

interface CompiledComponentGroup {
  name: ComponentGroupName;
  description: string;
  components: string[];
  promptSummary: string;
}

const builtinContracts =
  (schemaContractsModule as { builtinContracts?: ComponentContract[] }).builtinContracts
  ?? (schemaContractsModule as { default?: { builtinContracts?: ComponentContract[] } }).default?.builtinContracts
  ?? [];

const builtinContractMap = Object.fromEntries(
  builtinContracts.map((contract) => [contract.componentType, contract]),
) as Record<string, ComponentContract>;

const componentGroupDefinitions: ComponentGroupDefinition[] = [
  {
    name: 'layout-shell',
    description: 'layout wrappers for page sections and grid composition',
    components: ['Container', 'Space', 'Row', 'Col'],
  },
  {
    name: 'typography',
    description: 'page headings, helper text, and content copy',
    components: ['Typography.Title', 'Typography.Text', 'Typography.Paragraph'],
  },
  {
    name: 'actions',
    description: 'primary and secondary action triggers',
    components: ['Button'],
  },
  {
    name: 'filters-form',
    description: 'query conditions and form controls for admin pages',
    components: ['Form', 'FormItem', 'Input', 'Select', 'DatePicker'],
  },
  {
    name: 'feedback-status',
    description: 'status emphasis, alerts, and labels',
    components: ['Alert', 'Tag'],
  },
  {
    name: 'data-display',
    description: 'cards, data views, detail blocks, tabs, and timelines',
    components: [
      'Card',
      'Statistic',
      'Table',
      'Descriptions',
      'Descriptions.Item',
      'Tabs',
      'Tabs.TabPane',
      'Timeline',
      'Timeline.Item',
    ],
  },
];

const zoneGroupMap: Record<ZoneType, ComponentGroupName[]> = {
  'page-header': ['layout-shell', 'typography', 'actions'],
  filter: ['data-display', 'filters-form', 'layout-shell', 'actions'],
  'kpi-row': ['layout-shell', 'data-display', 'feedback-status'],
  'data-table': ['data-display', 'actions', 'feedback-status'],
  'detail-info': ['data-display', 'typography', 'feedback-status'],
  'form-body': ['data-display', 'filters-form'],
  'form-actions': ['layout-shell', 'actions'],
  'chart-area': ['data-display', 'typography', 'feedback-status'],
  'timeline-area': ['data-display', 'typography'],
  'side-info': ['data-display', 'typography', 'feedback-status'],
  'empty-state': ['data-display', 'typography', 'actions'],
  custom: ['layout-shell', 'typography', 'actions', 'data-display'],
};

function summarizeContract(contract: ComponentContract): CompiledComponentSummary {
  const propSummary = Object.entries(contract.props ?? {})
    .slice(0, 4)
    .map(([name, prop]) => `${name}:${prop.type}`);
  const eventSummary = Object.keys(contract.events ?? {})
    .slice(0, 3)
    .map((name) => name);

  return {
    componentType: contract.componentType,
    category: contract.category ?? 'general',
    childrenType: contract.children?.type ?? 'none',
    propSummary,
    eventSummary,
  };
}

function compileComponentGroup(definition: ComponentGroupDefinition): CompiledComponentGroup {
  const components = definition.components.filter((componentType) => builtinContractMap[componentType]);
  const promptSummary = components
    .map((componentType) => {
      const summary = summarizeContract(builtinContractMap[componentType]!);
      const propPart = summary.propSummary.length > 0 ? `props=${summary.propSummary.join(', ')}` : 'props=minimal';
      const eventPart = summary.eventSummary.length > 0 ? `events=${summary.eventSummary.join(', ')}` : 'events=none';
      return `${summary.componentType} [${summary.category}] children=${summary.childrenType}; ${propPart}; ${eventPart}`;
    })
    .join('\n');

  return {
    name: definition.name,
    description: definition.description,
    components,
    promptSummary,
  };
}

const compiledGroups = componentGroupDefinitions.map(compileComponentGroup);
const compiledGroupMap = Object.fromEntries(compiledGroups.map((group) => [group.name, group])) as Record<ComponentGroupName, CompiledComponentGroup>;

function uniqueComponents(groups: readonly ComponentGroupName[]): string[] {
  return [...new Set(groups.flatMap((groupName) => compiledGroupMap[groupName].components))];
}

export const supportedComponents = uniqueComponents(componentGroupDefinitions.map((group) => group.name)) as string[];
export const supportedComponentList = supportedComponents.join(', ');
export const supportedComponentSet = new Set(supportedComponents);
export const supportedContracts = builtinContracts.filter((contract) => supportedComponentSet.has(contract.componentType));
export const componentGroups = compiledGroups;

export function getPlannerContractSummary(): string {
  return compiledGroups
    .map((group) => `Group ${group.name}: ${group.description}\n${group.promptSummary}`)
    .join('\n\n');
}

export function getZoneContractSummary(zoneType: ZoneType, preferredComponents: readonly string[] = []): string {
  const groups = zoneGroupMap[zoneType];
  const preferredSet = new Set(preferredComponents);
  const orderedComponents = uniqueComponents(groups).sort((left, right) => {
    const leftPreferred = preferredSet.has(left) ? 1 : 0;
    const rightPreferred = preferredSet.has(right) ? 1 : 0;
    return rightPreferred - leftPreferred;
  });

  return orderedComponents
    .map((componentType) => {
      const contract = builtinContractMap[componentType];
      if (!contract) {
        return null;
      }
      const summary = summarizeContract(contract);
      const props = summary.propSummary.length > 0 ? summary.propSummary.join(', ') : 'minimal props';
      const preferred = preferredSet.has(componentType) ? 'preferred' : 'allowed';
      return `${summary.componentType} (${preferred}, ${summary.category}, children=${summary.childrenType}, ${props})`;
    })
    .filter(Boolean)
    .join('\n');
}

export function getZoneComponentCandidates(zoneType: ZoneType): string[] {
  return uniqueComponents(zoneGroupMap[zoneType]);
}
