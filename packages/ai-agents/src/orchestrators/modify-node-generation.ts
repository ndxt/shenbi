import type { PlanInsertNodeSkeleton } from './modify-planning';

export interface InsertNodePromptInput {
  skeleton: PlanInsertNodeSkeleton;
  documentTree?: string;
  componentContracts: string;
}

export interface InsertNodePromptSpec {
  systemText: string;
  userLines: string[];
}

function describeInsertTarget(skeleton: PlanInsertNodeSkeleton): string {
  if (skeleton.parentId) {
    return `Parent node: ${skeleton.parentId}`;
  }
  if (skeleton.container) {
    return `Container: ${skeleton.container} (root level)`;
  }
  return 'Append to page body';
}

function describeInsertPosition(skeleton: PlanInsertNodeSkeleton): string {
  return skeleton.index !== undefined ? `Insert position: index=${skeleton.index}` : 'Append at end';
}

export function buildInsertNodePromptSpec(input: InsertNodePromptInput): InsertNodePromptSpec {
  const { skeleton, documentTree, componentContracts } = input;

  return {
    systemText: [
      'You are a low-code schema node generator.',
      'Return JSON only: {"node": {...}}',
      'The node MUST follow the component contracts below.',
      '',
      '## Component Contracts',
      componentContracts,
      '',
      '## Rules',
      '- node MUST have "id" (unique kebab-case string) and "component" field.',
      '- Text content goes in top-level "children" (NOT "props.children").',
      '- Use the schema-example format from contracts above.',
      '- Generate realistic Chinese business content when applicable.',
      '- Each nested node MUST have a unique "id".',
      '- Keep the node structure minimal and clean.',
    ].join('\n'),
    userLines: [
      `Task: ${skeleton.description ?? 'Generate a node'}`,
      describeInsertTarget(skeleton),
      describeInsertPosition(skeleton),
      '',
      'Schema Tree (for context):',
      documentTree ?? '',
    ],
  };
}
