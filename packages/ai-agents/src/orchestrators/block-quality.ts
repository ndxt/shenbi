import type { SchemaNode } from '@shenbi/schema';
import type { GenerateBlockInput, GenerateBlockResult } from '../types';

export interface BlockQualityDiagnostic {
  blockId: string;
  rule: string;
  message: string;
  severity: 'warn' | 'retry';
  componentType?: string;
}

function isSchemaNode(value: unknown): value is SchemaNode {
  return Boolean(value) && typeof value === 'object' && typeof (value as SchemaNode).component === 'string';
}

function walkSchemaNodes(
  value: unknown,
  visitor: (node: SchemaNode) => void,
): void {
  if (!value) {
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      walkSchemaNodes(item, visitor);
    }
    return;
  }
  if (typeof value === 'string') {
    return;
  }
  if (!isSchemaNode(value)) {
    return;
  }
  visitor(value);
  walkSchemaNodes(value.children, visitor);
}

function getNodeText(value: unknown): string {
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value).trim();
  }
  if (Array.isArray(value)) {
    return value.map((item) => getNodeText(item)).filter(Boolean).join(' ').trim();
  }
  if (isSchemaNode(value)) {
    return getNodeText(value.children);
  }
  return '';
}

function nodeHasComponent(node: SchemaNode, componentType: string): boolean {
  let found = false;
  walkSchemaNodes(node, (current) => {
    if (current.component === componentType) {
      found = true;
    }
  });
  return found;
}

function getChildNodes(value: unknown): SchemaNode[] {
  return Array.isArray(value)
    ? value.filter(isSchemaNode)
    : [];
}

function countDescendantComponents(value: unknown, componentType: string): number {
  let count = 0;
  walkSchemaNodes(value, (node) => {
    if (node.component === componentType) {
      count += 1;
    }
  });
  return count;
}

function isKpiBlock(input: Pick<GenerateBlockInput, 'block'>): boolean {
  return input.block.id.includes('kpi')
    || /指标|kpi|概览|summary/.test(input.block.description)
    || input.block.components.some((component) => ['Statistic', 'Progress', 'Tag'].includes(component));
}

function isFilterBlock(input: Pick<GenerateBlockInput, 'block'>): boolean {
  return input.block.id.includes('filter')
    || /筛选|查询|搜索/.test(input.block.description)
    || input.block.components.some((component) => component.startsWith('Form') || component.includes('DatePicker'));
}

function isAdvancedFilterBlock(input: Pick<GenerateBlockInput, 'block'>): boolean {
  return /高级筛选|高级查询|高级搜索|折叠筛选|折叠查询|更多条件|多条件|advanced/i.test(input.block.description);
}

export function isMasterListBlock(input: Pick<GenerateBlockInput, 'block'>): boolean {
  return input.block.id.includes('master')
    || /左侧主数据列表|主从|主列表|主数据列表|左侧树|左侧列表|选中状态/.test(input.block.description);
}

export function isMasterDetailPrompt(prompt: string): boolean {
  return (/主从|master[-\s]?detail/i.test(prompt) || /左侧.*(树|列表)|右侧.*tabs?/i.test(prompt))
    && /详情|tabs?|树|列表/i.test(prompt);
}

function isTabsOrTrendBlock(input: Pick<GenerateBlockInput, 'block'>): boolean {
  return input.block.components.includes('Tabs')
    || /趋势|tab|tabs/.test(input.block.description.toLowerCase())
    || input.block.id.includes('tab');
}

function isActionFocusedBlock(input: Pick<GenerateBlockInput, 'block'>): boolean {
  return input.block.id.includes('header')
    || input.block.id.includes('action')
    || /操作|按钮|快捷入口|快捷操作|主操作/.test(input.block.description);
}

function getKpiCardKind(card: SchemaNode): string {
  const childNodes = Array.isArray(card.children)
    ? card.children.filter(isSchemaNode)
    : [];
  const hasStatistic = childNodes.some((child) => child.component === 'Statistic');
  const hasProgress = childNodes.some((child) => child.component === 'Progress');
  const hasTag = nodeHasComponent(card, 'Tag');
  const hasText = nodeHasComponent(card, 'Typography.Text');
  if (hasTag && !hasStatistic && !hasProgress && !hasText) {
    return 'tag-only';
  }
  if (hasProgress && !hasStatistic) {
    return 'progress';
  }
  if (hasStatistic && !hasProgress && !hasTag) {
    return 'statistic';
  }
  return 'mixed';
}

export function assessBlockQuality(
  node: GenerateBlockResult['node'],
  input: Pick<GenerateBlockInput, 'block'>,
): BlockQualityDiagnostic[] {
  const diagnostics: BlockQualityDiagnostic[] = [];

  walkSchemaNodes(node, (current) => {
    if (current.component === 'Alert') {
      const message = getNodeText(current.props?.message);
      const description = getNodeText(current.props?.description);
      if (!message && !description) {
        diagnostics.push({
          blockId: input.block.id,
          componentType: 'Alert',
          rule: 'alert-missing-copy',
          message: 'Alert must provide message or description; empty alerts create a blank highlighted box.',
          severity: 'retry',
        });
      }
      return;
    }

    if (current.component === 'Button') {
      const text = getNodeText(current.children);
      if (!text) {
        diagnostics.push({
          blockId: input.block.id,
          componentType: 'Button',
          rule: 'button-missing-text',
          message: isFilterBlock(input) || isActionFocusedBlock(input)
            ? 'Buttons in filter or action regions must include visible text in top-level children.'
            : 'Button has no visible text. Use top-level children for the label unless this is an intentional icon-only button.',
          severity: isFilterBlock(input) || isActionFocusedBlock(input) ? 'retry' : 'warn',
        });
      }
    }
  });

  if (isFilterBlock(input)) {
    walkSchemaNodes(node, (current) => {
      if (current.component !== 'Form') {
        return;
      }
      const children = Array.isArray(current.children)
        ? current.children.filter(isSchemaNode)
        : [];
      const formItems = children.filter((child) => child.component === 'Form.Item');
      const inlineLayout = current.props?.layout === 'inline';
      const hasRangePicker = nodeHasComponent(current, 'DatePicker.RangePicker');
      if (inlineLayout && (formItems.length > 3 || hasRangePicker)) {
        diagnostics.push({
          blockId: input.block.id,
          componentType: 'Form',
          rule: 'filter-inline-overflow',
          message: 'Filter blocks with RangePicker or more than 3 fields should use a Row/Col-based horizontal search bar or a controlled second row, not a single cramped inline row.',
          severity: 'retry',
        });
      }
      if (formItems.some((item) => !getNodeText(item.props?.label))) {
        diagnostics.push({
          blockId: input.block.id,
          componentType: 'Form.Item',
          rule: 'filter-actions-mixed-with-fields',
          message: 'Filter action buttons should be separated into a tail action area instead of an empty-label Form.Item.',
          severity: 'retry',
        });
      }
      if (!isAdvancedFilterBlock(input) && current.props?.layout === 'vertical') {
        const directChildren = getChildNodes(current.children);
        const directRows = directChildren.filter((child) => child.component === 'Row');
        const rowColumns = directRows.flatMap((row) =>
          getChildNodes(row.children).filter((child) => child.component === 'Col'));
        const totalFormItems = countDescendantComponents(current.children, 'Form.Item');
        const directFieldCount = directChildren.filter((child) => child.component === 'Form.Item').length;
        const fieldColumns = rowColumns.filter((column) => countDescendantComponents(column.children, 'Form.Item') > 0);
        const actionColumns = rowColumns.filter((column) =>
          countDescendantComponents(column.children, 'Button') > 0
          && countDescendantComponents(column.children, 'Form.Item') === 0);
        const stackedFieldColumn = fieldColumns.some((column) =>
          countDescendantComponents(column.children, 'Form.Item') >= 2);
        const separateActionArea = actionColumns.length > 0
          || directChildren.some((child) =>
            child.component === 'Container'
            && countDescendantComponents(child.children, 'Button') > 0
            && countDescendantComponents(child.children, 'Form.Item') === 0);
        if (
          totalFormItems >= 2
          && totalFormItems <= 3
          && separateActionArea
          && (stackedFieldColumn || directFieldCount >= 2)
        ) {
          diagnostics.push({
            blockId: input.block.id,
            componentType: 'Form',
            rule: 'filter-vertical-stacked-layout',
            message: 'Dashboard/list filters with 2-3 fields should stay in one horizontal search bar. Keep fields and action buttons in the same row, and use a wider date column instead of a left stacked field column.',
            severity: 'retry',
          });
        }
      }
    });
  }

  if (isKpiBlock(input)) {
    walkSchemaNodes(node, (current) => {
      if (current.component !== 'Row') {
        return;
      }
      const columns = Array.isArray(current.children)
        ? current.children.filter((child): child is SchemaNode => isSchemaNode(child) && child.component === 'Col')
        : [];
      if (columns.length > 4) {
        diagnostics.push({
          blockId: input.block.id,
          componentType: 'Row',
          rule: 'kpi-too-many-cards',
          message: 'A KPI row should contain at most 4 cards to preserve even rhythm and visual weight.',
          severity: 'retry',
        });
      }
      const kinds = new Set<string>();
      for (const column of columns) {
        const card = Array.isArray(column.children)
          ? column.children.find((child): child is SchemaNode => isSchemaNode(child) && child.component === 'Card')
          : undefined;
        if (!card) {
          continue;
        }
        kinds.add(getKpiCardKind(card));
      }
      if (kinds.has('tag-only')) {
        diagnostics.push({
          blockId: input.block.id,
          componentType: 'Card',
          rule: 'kpi-tag-only-card',
          message: 'A KPI card should not be tag-only; it must include a main value and one secondary line.',
          severity: 'retry',
        });
      }
      if (kinds.size > 1) {
        diagnostics.push({
          blockId: input.block.id,
          componentType: 'Row',
          rule: 'kpi-mixed-card-structures',
          message: 'KPI cards in one row should share a consistent structure instead of mixing progress-only, text-heavy, and mixed-detail cards.',
          severity: 'retry',
        });
      }
    });
  }

  if (isTabsOrTrendBlock(input)) {
    walkSchemaNodes(node, (current) => {
      if (current.component !== 'Tabs.TabPane') {
        return;
      }
      let alertCount = 0;
      let cardCount = 0;
      walkSchemaNodes(current.children, (child) => {
        if (child.component === 'Alert') {
          alertCount += 1;
        }
        if (child.component === 'Card') {
          cardCount += 1;
        }
      });
      if (alertCount > 1 || cardCount > 4) {
        diagnostics.push({
          blockId: input.block.id,
          componentType: 'Tabs.TabPane',
          rule: 'tab-pane-fragmented-layout',
          message: 'Each tab pane should stay focused: one alert, one short description, and one main data area instead of many tiny cards.',
          severity: 'retry',
        });
      }
    });
  }

  if (isMasterListBlock(input)) {
    let multilineButtonCardCount = 0;
    let overdenseItemFound = false;
    walkSchemaNodes(node, (current) => {
      if (current.component !== 'Button' || current.props?.type !== 'text' || current.props?.block !== true) {
        return;
      }
      const tagCount = countDescendantComponents(current.children, 'Tag');
      const typographyCount = countDescendantComponents(current.children, 'Typography.Text');
      const nestedTextLength = getNodeText(current.children).length;
      if (tagCount > 0 && typographyCount >= 2) {
        multilineButtonCardCount += 1;
      }
      if (tagCount >= 2 || nestedTextLength > 32) {
        overdenseItemFound = true;
      }
    });
    if (multilineButtonCardCount > 0) {
      diagnostics.push({
        blockId: input.block.id,
        componentType: 'Button',
        rule: 'master-list-button-card-layout',
        message: 'Left-side master lists should not use Button type="text" as a multi-line card wrapper. Use compact Container/Card list items with one title line, one status line, and one short description.',
        severity: 'retry',
      });
    }
    if (overdenseItemFound) {
      diagnostics.push({
        blockId: input.block.id,
        componentType: 'Container',
        rule: 'side-list-overdense',
        message: 'Items in a narrow master list column are too dense. Keep each item compact: short title, one meta line, and one short truncated description.',
        severity: 'retry',
      });
    }
  }

  return diagnostics;
}

function qualityScore(diagnostics: BlockQualityDiagnostic[]): number {
  return diagnostics.reduce((score, item) => score + (item.severity === 'retry' ? 2 : 1), 0);
}

export function shouldUseRetryResult(
  currentDiagnostics: BlockQualityDiagnostic[],
  retryDiagnostics: BlockQualityDiagnostic[],
): boolean {
  return qualityScore(retryDiagnostics) < qualityScore(currentDiagnostics);
}
