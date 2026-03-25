import { describe, expect, it } from 'vitest';
import type { PageSchema } from '@shenbi/schema';
import {
  compareRegressionReports,
  evaluateCreateEventSequence,
  evaluateModifyEventSequence,
  representativeSchemaCases,
  runOfflineSchemaRegression,
} from './offline-regression.ts';

describe('offline regression harness', () => {
  it('validates representative schema fixtures with local acceptance rules', async () => {
    const buttonSchema: PageSchema = {
      id: 'page-button',
      body: [
        {
          id: 'submit-button',
          component: 'Button',
          props: {
            type: 'primary',
          },
          children: '提交',
        },
      ],
    };

    const actionSchema: PageSchema = {
      id: 'page-action',
      body: [
        {
          id: 'set-state-button',
          component: 'Button',
          children: '设置姓名',
          events: {
            onClick: [
              {
                type: 'setState',
                key: 'name',
                value: '张三',
              },
            ],
          },
        },
      ],
    };

    const report = await runOfflineSchemaRegression([
      { caseId: 'rep-button-001', schema: buttonSchema },
      { caseId: 'rep-action-setstate-001', schema: actionSchema },
    ], representativeSchemaCases.filter((item) =>
      item.id === 'rep-button-001' || item.id === 'rep-action-setstate-001'));

    expect(report.summary.passed).toBe(2);
    expect(report.summary.failed).toBe(0);
  });

  it('keeps a representative regression corpus for phase-1 coverage', () => {
    expect(representativeSchemaCases.length).toBeGreaterThanOrEqual(8);
    expect(representativeSchemaCases.some((item) => item.sourceId === 'llm-gen:button-001')).toBe(true);
    expect(representativeSchemaCases.some((item) => item.sourceId === 'llm-gen:table-001')).toBe(true);
    expect(representativeSchemaCases.some((item) => item.sourceId === 'llm-gen:action-setstate-001')).toBe(true);
  });

  it('validates create and modify event sequences for offline regression', () => {
    const createCheck = evaluateCreateEventSequence([
      { type: 'run:start', data: { sessionId: 's1' } },
      { type: 'intent', data: { intent: 'schema.create', confidence: 1 } },
      { type: 'schema:skeleton', data: { schema: { id: 'page-1', body: [] } } },
      { type: 'schema:block', data: { blockId: 'block-1', node: { id: 'card-1', component: 'Card' } } },
      { type: 'done', data: { metadata: { sessionId: 's1' } } },
    ]);
    const modifyCheck = evaluateModifyEventSequence([
      { type: 'run:start', data: { sessionId: 's2' } },
      { type: 'intent', data: { intent: 'schema.modify', confidence: 1 } },
      {
        type: 'modify:start',
        data: {
          operationCount: 1,
          explanation: '更新标题',
          operations: [{ op: 'schema.patchProps', nodeId: 'card-1' }],
        },
      },
      { type: 'modify:op:pending', data: { index: 0, label: '更新标题' } },
      {
        type: 'modify:op',
        data: {
          index: 0,
          operation: {
            op: 'schema.patchProps',
            nodeId: 'card-1',
            patch: { title: '本月营收' },
          },
        },
      },
      { type: 'modify:done', data: {} },
      { type: 'done', data: { metadata: { sessionId: 's2' } } },
    ]);

    expect(createCheck).toEqual({ passed: true, errors: [] });
    expect(modifyCheck).toEqual({ passed: true, errors: [] });
  });

  it('compares mastra against legacy with a no-regression threshold', () => {
    const legacyReport = {
      summary: { total: 4, passed: 3, failed: 1, passRate: 75 },
      results: [],
    };

    const mastraReport = {
      summary: { total: 4, passed: 4, failed: 0, passRate: 100 },
      results: [],
    };

    expect(compareRegressionReports(legacyReport, mastraReport)).toEqual({
      passed: true,
      legacyPassRate: 75,
      mastraPassRate: 100,
      legacyFailed: 1,
      mastraFailed: 0,
    });
  });
});
