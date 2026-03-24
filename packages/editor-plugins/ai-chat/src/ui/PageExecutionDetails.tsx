import React from 'react';
import { CheckCircle2, LoaderCircle } from 'lucide-react';
import { useTranslation } from '@shenbi/i18n';
import type { AgentOperationMetrics } from '@shenbi/ai-contracts';
import type { PageExecutionSnapshot } from '../ai/page-execution';

export interface PageExecutionDetailsProps {
  snapshot: PageExecutionSnapshot | null | undefined;
  variant?: 'standalone' | 'embedded';
  isRunning?: boolean;
}

function MetricsBadge({
  durationMs,
  inputTokens,
  outputTokens,
}: {
  durationMs: number | undefined;
  inputTokens: number | undefined;
  outputTokens: number | undefined;
}) {
  const parts: string[] = [];
  if (durationMs !== undefined) parts.push(`${(durationMs / 1000).toFixed(1)}s`);
  if (inputTokens !== undefined) parts.push(`In${inputTokens}`);
  if (outputTokens !== undefined) parts.push(`Out${outputTokens}`);
  if (parts.length === 0) return null;
  return <span className="text-text-secondary font-mono tabular-nums shrink-0" style={{ fontSize: '9px' }}>{parts.join(' ')}</span>;
}

function OpRow({
  label,
  isPending,
  isDone,
  metrics,
  isError,
}: {
  label: string;
  isPending?: boolean;
  isDone?: boolean;
  metrics?: { durationMs: number | undefined; inputTokens: number | undefined; outputTokens: number | undefined };
  isError?: boolean;
}) {
  return (
    <li
      className="flex items-center gap-1.5 py-0.5 rounded px-1.5"
      style={{ fontSize: '11px' }}
    >
      <span className="text-text-primary opacity-80 truncate flex-1 leading-none translate-y-[1px]" title={label}>{label}</span>
      {isDone && metrics && <MetricsBadge durationMs={metrics.durationMs} inputTokens={metrics.inputTokens} outputTokens={metrics.outputTokens} />}
      {isPending && <LoaderCircle size={11} className="text-primary shrink-0 animate-spin" />}
      {isDone && !isPending && (
        <CheckCircle2
          size={11}
          className={`shrink-0 ${isError ? 'text-red-400' : 'text-emerald-400'}`}
        />
      )}
    </li>
  );
}

export function summarizeExecutionTokens(snapshot: PageExecutionSnapshot | null | undefined) {
  if (!snapshot) {
    return { totalInput: 0, totalOutput: 0 };
  }
  const totalInput = [
    snapshot.plannerMetrics?.inputTokens ?? 0,
    ...Object.values(snapshot.blockInputTokens),
    ...Object.values(snapshot.modifyOpMetrics).map((metrics: AgentOperationMetrics) => metrics.inputTokens ?? 0),
  ].reduce((sum, value) => sum + value, 0);
  const totalOutput = [
    snapshot.plannerMetrics?.outputTokens ?? 0,
    ...Object.values(snapshot.blockOutputTokens),
    ...Object.values(snapshot.modifyOpMetrics).map((metrics: AgentOperationMetrics) => metrics.outputTokens ?? 0),
  ].reduce((sum, value) => sum + value, 0);
  return { totalInput, totalOutput };
}

export function PageExecutionDetails({
  snapshot,
  variant = 'standalone',
  isRunning = false,
}: PageExecutionDetailsProps) {
  const { t } = useTranslation('pluginAiChat');

  if (!snapshot) {
    return null;
  }

  const embedded = variant === 'embedded';
  const wrapperClassName = embedded
    ? 'flex flex-col gap-1.5 pt-1'
    : 'border-t border-border-ide pt-2 pb-1';

  return (
    <div className={wrapperClassName}>
      {snapshot.plannerMetrics && snapshot.plan && (
        <div className={`${embedded ? 'rounded bg-bg-canvas/80 px-2 py-1.5' : 'py-2 px-1'} flex items-center gap-1.5`}>
          <span className="text-text-secondary opacity-70 truncate flex-1 leading-none translate-y-[1px]" style={{ fontSize: '10px' }}>Planner</span>
          <MetricsBadge
            durationMs={snapshot.plannerMetrics.durationMs}
            inputTokens={snapshot.plannerMetrics.inputTokens}
            outputTokens={snapshot.plannerMetrics.outputTokens}
          />
          <CheckCircle2 size={10} className="text-emerald-400 shrink-0" />
        </div>
      )}

      {snapshot.plan && (
        <div className={embedded ? '' : 'pt-1'}>
          <ul className="flex flex-col gap-1.5 m-0 p-0">
            {snapshot.plan.blocks.map((block) => (
              <OpRow
                key={block.id}
                label={block.description}
                isPending={snapshot.blockStatuses[block.id] === 'generating' && isRunning}
                isDone={snapshot.blockStatuses[block.id] === 'done'}
                metrics={{
                  durationMs: snapshot.blockDurationMs[block.id],
                  inputTokens: snapshot.blockInputTokens[block.id],
                  outputTokens: snapshot.blockOutputTokens[block.id],
                }}
              />
            ))}
          </ul>
        </div>
      )}

      {snapshot.modifyPlan && (
        <div className={embedded ? '' : 'pt-1'}>
          <ul className="flex flex-col gap-1.5 m-0 p-0">
            {Array.from({ length: snapshot.modifyPlan.operationCount }, (_, index) => (
              <OpRow
                key={index}
                label={snapshot.modifyPlan?.operationLabels[index] ?? t('status.operationWithIndex', { index: index + 1 })}
                isPending={snapshot.modifyStatuses[index] === 'generating' && isRunning}
                isDone={snapshot.modifyStatuses[index] === 'done'}
                isError={snapshot.modifyStatuses[index] === 'failed'}
                {...(snapshot.modifyOpMetrics[index]
                  ? {
                      metrics: {
                        durationMs: snapshot.modifyOpMetrics[index].durationMs,
                        inputTokens: snapshot.modifyOpMetrics[index].inputTokens,
                        outputTokens: snapshot.modifyOpMetrics[index].outputTokens,
                      },
                    }
                  : {})}
              />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
