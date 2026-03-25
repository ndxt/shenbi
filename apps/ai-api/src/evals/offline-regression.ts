import type { AgentEvent } from '@shenbi/ai-contracts';
import type { PageSchema, SchemaNode } from '@shenbi/schema';

export interface RepresentativeRegressionCase {
  id: string;
  sourceId: string;
  prompt: string;
  expectedComponent?: string;
  expectedProps?: string[];
  expectedActions?: string[];
}

export const representativeSchemaCases: RepresentativeRegressionCase[] = [
  {
    id: 'rep-button-001',
    sourceId: 'llm-gen:button-001',
    prompt: '创建一个_primary_类型的按钮，显示文本"提交"',
    expectedComponent: 'Button',
    expectedProps: ['type'],
  },
  {
    id: 'rep-input-001',
    sourceId: 'llm-gen:input-001',
    prompt: '创建一个文本输入框，占位符为"请输入用户名"',
    expectedComponent: 'Input',
    expectedProps: ['placeholder'],
  },
  {
    id: 'rep-form-001',
    sourceId: 'llm-gen:form-001',
    prompt: '创建一个基础表单，包含用户名和密码输入框',
    expectedComponent: 'Form',
  },
  {
    id: 'rep-table-001',
    sourceId: 'llm-gen:table-001',
    prompt: '创建一个基础表格，展示用户列表',
    expectedComponent: 'Table',
  },
  {
    id: 'rep-tabs-001',
    sourceId: 'llm-gen:tabs-001',
    prompt: '创建一个 Tabs 标签页，包含概览和详情两个标签',
    expectedComponent: 'Tabs',
  },
  {
    id: 'rep-statistic-001',
    sourceId: 'llm-gen:statistic-001',
    prompt: '创建一个统计卡片，显示本月销售额',
    expectedComponent: 'Statistic',
    expectedProps: ['title', 'value'],
  },
  {
    id: 'rep-action-setstate-001',
    sourceId: 'llm-gen:action-setstate-001',
    prompt: '创建一个按钮，点击时设置 state 的 name 字段为"张三"',
    expectedActions: ['setState'],
  },
  {
    id: 'rep-action-fetch-001',
    sourceId: 'llm-gen:action-fetch-001',
    prompt: '创建一个按钮，点击时发起 GET 请求获取用户列表',
    expectedActions: ['fetch'],
  },
];

export interface SchemaRegressionFixture {
  caseId: string;
  schema: PageSchema;
}

export interface OfflineSequenceCheck {
  passed: boolean;
  errors: string[];
}

export interface SchemaRegressionResult {
  caseId: string;
  sourceId: string;
  passed: boolean;
  errors: string[];
}

export interface SchemaRegressionReport {
  summary: {
    total: number;
    passed: number;
    failed: number;
    passRate: number;
  };
  results: SchemaRegressionResult[];
}

export interface RegressionComparison {
  passed: boolean;
  legacyPassRate: number;
  mastraPassRate: number;
  legacyFailed: number;
  mastraFailed: number;
}

function isSchemaNode(value: unknown): value is SchemaNode {
  return Boolean(value) && typeof value === 'object' && typeof (value as SchemaNode).component === 'string';
}

function walkSchemaNodes(value: unknown, visitor: (node: SchemaNode) => void): void {
  if (Array.isArray(value)) {
    for (const item of value) {
      walkSchemaNodes(item, visitor);
    }
    return;
  }

  if (!isSchemaNode(value)) {
    return;
  }

  visitor(value);
  walkSchemaNodes(value.children, visitor);

  if (value.slots && typeof value.slots === 'object') {
    for (const slotValue of Object.values(value.slots)) {
      walkSchemaNodes(slotValue, visitor);
    }
  }
}

function validateSchemaShape(schema: PageSchema): string[] {
  const errors: string[] = [];

  if (!schema || typeof schema !== 'object') {
    return ['schema must be an object'];
  }

  if (!schema.body) {
    errors.push('schema.body is required');
    return errors;
  }

  const bodyNodes = Array.isArray(schema.body) ? schema.body : [schema.body];
  if (bodyNodes.length === 0) {
    errors.push('schema.body must contain at least one node');
  }

  bodyNodes.forEach((node, index) => {
    if (!isSchemaNode(node)) {
      errors.push(`body[${index}] must be a schema node`);
    }
  });

  return errors;
}

function collectProps(schema: PageSchema): Set<string> {
  const props = new Set<string>();
  walkSchemaNodes(schema.body, (node) => {
    if (node.props && typeof node.props === 'object') {
      Object.keys(node.props).forEach((key) => props.add(key));
    }
  });
  return props;
}

function hasComponent(schema: PageSchema, component: string): boolean {
  let found = false;
  walkSchemaNodes(schema.body, (node) => {
    if (node.component === component) {
      found = true;
    }
  });
  return found;
}

function collectActions(schema: PageSchema): Set<string> {
  const actions = new Set<string>();
  walkSchemaNodes(schema.body, (node) => {
    if (!node.events || typeof node.events !== 'object') {
      return;
    }
    for (const eventValue of Object.values(node.events)) {
      if (!Array.isArray(eventValue)) {
        continue;
      }
      for (const action of eventValue) {
        if (action && typeof action === 'object' && 'type' in action && typeof action.type === 'string') {
          actions.add(action.type);
        }
      }
    }
  });
  return actions;
}

export async function runOfflineSchemaRegression(
  fixtures: SchemaRegressionFixture[],
  cases: RepresentativeRegressionCase[] = representativeSchemaCases,
): Promise<SchemaRegressionReport> {
  const fixtureMap = new Map(fixtures.map((fixture) => [fixture.caseId, fixture.schema]));
  const results: SchemaRegressionResult[] = cases.map((testCase) => {
    const schema = fixtureMap.get(testCase.id);
    const errors: string[] = [];

    if (!schema) {
      errors.push('missing fixture schema');
    } else {
      errors.push(...validateSchemaShape(schema));

      if (testCase.expectedComponent && !hasComponent(schema, testCase.expectedComponent)) {
        errors.push(`missing expected component: ${testCase.expectedComponent}`);
      }

      if (testCase.expectedProps && testCase.expectedProps.length > 0) {
        const actualProps = collectProps(schema);
        const missingProps = testCase.expectedProps.filter((prop) => !actualProps.has(prop));
        if (missingProps.length > 0) {
          errors.push(`missing expected props: ${missingProps.join(', ')}`);
        }
      }

      if (testCase.expectedActions && testCase.expectedActions.length > 0) {
        const actualActions = collectActions(schema);
        const missingActions = testCase.expectedActions.filter((action) => !actualActions.has(action));
        if (missingActions.length > 0) {
          errors.push(`missing expected actions: ${missingActions.join(', ')}`);
        }
      }
    }

    return {
      caseId: testCase.id,
      sourceId: testCase.sourceId,
      passed: errors.length === 0,
      errors,
    };
  });

  const passed = results.filter((item) => item.passed).length;
  const failed = results.length - passed;

  return {
    summary: {
      total: results.length,
      passed,
      failed,
      passRate: results.length > 0 ? (passed / results.length) * 100 : 0,
    },
    results,
  };
}

function indexOfEvent(events: AgentEvent[], type: AgentEvent['type']): number {
  return events.findIndex((event) => event.type === type);
}

function checkOrderedIndexes(
  events: AgentEvent[],
  requiredTypes: AgentEvent['type'][],
): OfflineSequenceCheck {
  const errors: string[] = [];
  const indexes = requiredTypes.map((type) => ({ type, index: indexOfEvent(events, type) }));

  for (const entry of indexes) {
    if (entry.index === -1) {
      errors.push(`missing event: ${entry.type}`);
    }
  }

  for (let index = 1; index < indexes.length; index += 1) {
    const previous = indexes[index - 1]!;
    const current = indexes[index]!;
    if (previous.index !== -1 && current.index !== -1 && previous.index >= current.index) {
      errors.push(`event order invalid: ${previous.type} should appear before ${current.type}`);
    }
  }

  return {
    passed: errors.length === 0,
    errors,
  };
}

export function evaluateCreateEventSequence(events: AgentEvent[]): OfflineSequenceCheck {
  return checkOrderedIndexes(events, [
    'run:start',
    'intent',
    'schema:skeleton',
    'schema:block',
    'done',
  ]);
}

export function evaluateModifyEventSequence(events: AgentEvent[]): OfflineSequenceCheck {
  return checkOrderedIndexes(events, [
    'run:start',
    'intent',
    'modify:start',
    'modify:op:pending',
    'modify:op',
    'modify:done',
    'done',
  ]);
}

export function compareRegressionReports(
  legacyReport: SchemaRegressionReport,
  mastraReport: SchemaRegressionReport,
): RegressionComparison {
  return {
    passed: mastraReport.summary.failed <= legacyReport.summary.failed
      && mastraReport.summary.passRate >= legacyReport.summary.passRate,
    legacyPassRate: legacyReport.summary.passRate,
    mastraPassRate: mastraReport.summary.passRate,
    legacyFailed: legacyReport.summary.failed,
    mastraFailed: mastraReport.summary.failed,
  };
}
