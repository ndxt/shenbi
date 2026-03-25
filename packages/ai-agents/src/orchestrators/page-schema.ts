import type { PageSchema } from '@shenbi/schema';
import type {
  AssembleSchemaInput,
  GenerateBlockResult,
  LayoutRow,
  PagePlan,
} from '../types';

function defaultLayoutFromBlocks(blockIds: string[]): LayoutRow[] {
  return [{ blocks: blockIds }];
}

function isBlocksRow(row: LayoutRow): row is Extract<LayoutRow, { blocks: string[] }> {
  return 'blocks' in row;
}

function createSkeletonBlock(blockId: string, _description: string): GenerateBlockResult['node'] {
  return {
    id: `${blockId}-skeleton`,
    component: 'Card',
    props: {
      style: {
        minHeight: 160,
      },
    },
    children: [
      {
        id: `${blockId}-skeleton-inner`,
        component: 'Skeleton',
        props: {
          active: true,
          paragraph: { rows: 3 },
        },
        children: [],
      },
    ],
  };
}

function buildStackNode(id: string, nodes: GenerateBlockResult['node'][], gap: number): GenerateBlockResult['node'] {
  if (nodes.length === 1) {
    return nodes[0]!;
  }

  return {
    id,
    component: 'Container',
    props: {
      direction: 'column',
      gap,
    },
    children: nodes,
  };
}

function isGeneratedNode(value: GenerateBlockResult['node'] | undefined): value is GenerateBlockResult['node'] {
  return Boolean(value);
}

function assembleFromLayout(
  layout: LayoutRow[],
  blockNodes: Record<string, GenerateBlockResult['node']>,
  gap: number,
): GenerateBlockResult['node'][] {
  return layout.map((row, rowIndex) => {
    if (isBlocksRow(row)) {
      const nodes = row.blocks.map((blockId) => blockNodes[blockId]).filter(isGeneratedNode);
      return buildStackNode(`layout-row-${rowIndex + 1}`, nodes, gap);
    }

    return {
      id: `layout-row-${rowIndex + 1}`,
      component: 'Row',
      props: {
        gutter: [gap, gap],
      },
      children: row.columns.map((column, columnIndex) => {
        const nodes = column.blocks.map((blockId) => blockNodes[blockId]).filter(isGeneratedNode);
        return {
          id: `layout-row-${rowIndex + 1}-col-${columnIndex + 1}`,
          component: 'Col',
          props: {
            span: column.span,
          },
          children: [buildStackNode(`layout-row-${rowIndex + 1}-col-${columnIndex + 1}-stack`, nodes, gap)],
        };
      }),
    };
  });
}

function findHeaderBlockId(plan: PagePlan): string | undefined {
  const layout = plan.layout ?? [];
  const firstRow = layout[0];
  if (!firstRow) {
    return undefined;
  }

  const firstIds = isBlocksRow(firstRow)
    ? firstRow.blocks
    : firstRow.columns.flatMap((column) => column.blocks);

  return plan.blocks.find((block) => {
    if (!firstIds.includes(block.id)) {
      return false;
    }
    const lower = `${block.id} ${block.description}`.toLowerCase();
    return /header|title|hero|banner|overview|summary|标题|概览/.test(lower);
  })?.id;
}

function getPageGap(pageType: PagePlan['pageType']): number {
  return pageType === 'dashboard' || pageType === 'statistics' ? 24 : 16;
}

function createPageShell(
  pageTitle: string,
  gap: number,
  assembledRows: GenerateBlockResult['node'][],
  headerBlockId?: string,
): PageSchema {
  const contentRows = headerBlockId ? assembledRows.slice(1) : assembledRows;

  return {
    id: 'ai-generated-page',
    name: pageTitle,
    body: [
      {
        id: 'page-root',
        component: 'Container',
        props: {
          direction: 'column',
          gap,
          style: {
            width: '100%',
            padding: 24,
            background: '#f5f7fa',
          },
        },
        children: [
          ...(headerBlockId
            ? [{
              id: 'page-header-shell',
              component: 'Container',
              props: {
                direction: 'column',
                gap: 10,
                style: {
                  padding: 20,
                  borderRadius: 16,
                  background: '#ffffff',
                  boxShadow: '0 8px 24px rgba(15, 23, 42, 0.06)',
                },
              },
              children: [assembledRows[0]!],
            }]
            : []),
          {
            id: 'page-content-shell',
            component: 'Container',
            props: {
              direction: 'column',
              gap,
            },
            children: contentRows,
          },
        ],
      },
    ],
  };
}

export function buildSkeletonSchema(plan: PagePlan): PageSchema {
  const gap = getPageGap(plan.pageType);
  const layout = plan.layout ?? defaultLayoutFromBlocks(plan.blocks.map((block) => block.id));
  const headerBlockId = findHeaderBlockId(plan);
  const skeletonNodes = Object.fromEntries(
    plan.blocks.map((block) => [block.id, createSkeletonBlock(block.id, block.description)]),
  ) as Record<string, GenerateBlockResult['node']>;
  const assembledRows = assembleFromLayout(layout, skeletonNodes, gap);

  return createPageShell(plan.pageTitle, gap, assembledRows, headerBlockId);
}

export function assembleSchema(input: AssembleSchemaInput): PageSchema {
  const gap = getPageGap(input.plan.pageType);
  const layout = input.plan.layout ?? defaultLayoutFromBlocks(input.plan.blocks.map((block) => block.id));
  const headerBlockId = findHeaderBlockId(input.plan);
  const blockNodes = Object.fromEntries(
    input.blocks.map((block) => [block.blockId, block.node]),
  ) as Record<string, GenerateBlockResult['node']>;
  const assembledRows = assembleFromLayout(layout, blockNodes, gap);

  return createPageShell(input.plan.pageTitle, gap, assembledRows, headerBlockId);
}
