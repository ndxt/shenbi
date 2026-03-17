import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { RunResultCard } from './RunResultCard';
import type { LastRunResult } from '../hooks/useAgentRun';
import { createPageExecutionSnapshot } from '../ai/page-execution';

describe('RunResultCard', () => {
  it('shows compact loop summary with collapsed page execution details and hides raw ReAct steps', () => {
    const execution = {
      ...createPageExecutionSnapshot('create'),
      plan: {
        pageTitle: '订单列表页',
        pageType: 'list',
        blocks: [
          {
            id: 'header-block',
            description: '页面标题和操作按钮区域',
            components: ['Typography.Title', 'Button'],
            priority: 1,
            complexity: 'simple' as const,
          },
        ],
      },
      blockStatuses: {
        'header-block': 'done' as const,
      },
      progressText: '页面生成完成',
      didApplySchema: true,
    };
    const result: LastRunResult = {
      plan: null,
      plannerMetrics: null,
      blockStatuses: {},
      blockTokens: {},
      blockInputTokens: {},
      blockOutputTokens: {},
      blockDurationMs: {},
      modifyPlan: null,
      modifyStatuses: {},
      modifyOpMetrics: {},
      elapsedMs: 1_200,
      statusLabel: '订单管理后台: 3/3 pages completed',
      didApplySchema: true,
      debugFile: '.ai-debug/traces/2026-03-16T00-00-00-000Z-success.json',
      agentLoop: {
        projectPlan: {
          projectName: '订单管理后台',
          pages: [
            {
              pageId: 'order-list',
              pageName: '订单列表页',
              action: 'create',
              description: '订单列表页',
            },
          ],
        },
        trace: [
          {
            stepIndex: 0,
            timestamp: '2026-03-16T00:00:00.000Z',
            action: 'listWorkspaceFiles',
            actionInput: {},
            observation: '[]',
          },
        ],
        pages: [
          {
            pageId: 'order-list',
            pageName: '订单列表页',
            action: 'create',
            description: '订单列表页',
            status: 'done',
            fileId: '订单列表页',
            execution,
          },
        ],
        createdFileIds: ['订单列表页'],
        traceFile: '.ai-debug/traces/2026-03-16T00-00-00-000Z-success.json',
      },
    };

    render(<RunResultCard result={result} />);

    expect(screen.getByText('Trace File: .ai-debug/traces/2026-03-16T00-00-00-000Z-success.json')).toBeInTheDocument();
    expect(screen.queryByText('页面标题和操作按钮区域')).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('expand page execution'));
    expect(screen.getByText('页面标题和操作按钮区域')).toBeInTheDocument();
    expect(screen.queryByText('项目规划')).not.toBeInTheDocument();
    expect(screen.queryByText('ReAct 步骤')).not.toBeInTheDocument();
    expect(screen.queryByText(/listWorkspaceFiles/)).not.toBeInTheDocument();
  });
});
