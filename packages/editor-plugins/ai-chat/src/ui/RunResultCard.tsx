import React from 'react';
import { CheckCircle2 } from 'lucide-react';
import { useTranslation } from '@shenbi/i18n';
import type { LastRunResult } from '../hooks/useAgentRun';
import type { AgentOperationMetrics } from '@shenbi/ai-contracts';
import { ProjectPlanCard } from './ProjectPlanCard';

const MetricsBadge = ({ durationMs, inputTokens, outputTokens }: { durationMs: number | undefined; inputTokens: number | undefined; outputTokens: number | undefined }) => {
  const parts: string[] = [];
  if (durationMs !== undefined) parts.push(`${(durationMs / 1000).toFixed(1)}s`);
  if (inputTokens !== undefined) parts.push(`In${inputTokens}`);
  if (outputTokens !== undefined) parts.push(`Out${outputTokens}`);
  if (parts.length === 0) return null;
  return <span className="text-text-secondary font-mono tabular-nums shrink-0" style={{ fontSize: '9px' }}>{parts.join(' ')}</span>;
};

const OpRow = ({
  label,
  isDone,
  metrics,
  isError,
}: {
  label: string;
  isDone?: boolean;
  metrics?: { durationMs: number | undefined; inputTokens: number | undefined; outputTokens: number | undefined };
  isError?: boolean;
}) => (
  <li className="flex items-center gap-1.5 py-0.5 rounded px-1.5" style={{ fontSize: '11px' }}>
    <span className="text-text-primary opacity-80 truncate flex-1 leading-none translate-y-[1px]" title={label}>{label}</span>
    {isDone && metrics && <MetricsBadge durationMs={metrics.durationMs} inputTokens={metrics.inputTokens} outputTokens={metrics.outputTokens} />}
    {isDone && (
      <CheckCircle2
        size={11}
        className={`shrink-0 ${isError ? 'text-red-400' : 'text-emerald-400'}`}
      />
    )}
  </li>
);

export interface RunResultCardProps {
  result: LastRunResult;
  onDismiss?: (() => void) | undefined;
}

export function RunResultCard({ result, onDismiss }: RunResultCardProps) {
  const { t } = useTranslation('pluginAiChat');

  const totalInput = [
    result.plannerMetrics?.inputTokens ?? 0,
    ...Object.values(result.blockInputTokens),
    ...Object.values(result.modifyOpMetrics).map((m: AgentOperationMetrics) => m.inputTokens ?? 0),
  ].reduce((a, b) => a + b, 0);
  const totalOutput = [
    result.plannerMetrics?.outputTokens ?? 0,
    ...Object.values(result.blockOutputTokens),
    ...Object.values(result.modifyOpMetrics).map((m: AgentOperationMetrics) => m.outputTokens ?? 0),
  ].reduce((a, b) => a + b, 0);
  const hasTokenInfo = totalInput > 0 || totalOutput > 0;

  // Helper function to get debug file label from translation
  const getDebugFileLabel = (path: string) => {
    return /(?:^|[\\/])(?:\.ai-debug[\\/])?traces(?:[\\/]|$)/i.test(path)
      ? t('result.traceFile')
      : t('result.debugFile');
  };

  if (result.agentLoop) {
    const loopSummary = result.agentLoop;
    return (
      <div className="bg-bg-canvas border border-border-ide rounded-md p-3 flex flex-col gap-3 shadow-sm mt-2" style={{ fontSize: '11px' }}>
        <div className="flex items-center gap-2 text-text-primary">
          <CheckCircle2 size={12} className="text-emerald-400 shrink-0" />
          <span className="font-semibold text-emerald-400 shrink-0">{t('loop.loopDone')}</span>
          <span className="opacity-70 ml-1 truncate flex-1 leading-none">{result.statusLabel}</span>
          {onDismiss && (
            <button
              className="text-text-secondary hover:text-text-primary opacity-50 hover:opacity-100 transition-opacity ml-1 shrink-0"
              onClick={onDismiss}
              title={t('result.dismiss')}
            >
              ×
            </button>
          )}
        </div>

        <ProjectPlanCard
          projectPlan={loopSummary.projectPlan ?? null}
          pages={loopSummary.pages}
          phase="done"
          embedded
          planRevisionRequested={false}
          onConfirm={() => undefined}
          onRequestRevision={() => undefined}
          onCancelRevision={() => undefined}
          onSubmitRevision={() => undefined}
        />

        {(typeof result.durationMs === 'number' || result.debugFile || result.memoryDebugFile) && (
          <div className="text-text-secondary flex flex-col items-center gap-1 opacity-50 pt-1" style={{ fontSize: '10px' }}>
            {typeof result.durationMs === 'number' && (
              <span>{t('result.duration')}: {result.durationMs}ms</span>
            )}
            {result.debugFile && (
              <span className="font-mono break-all text-center">
                {getDebugFileLabel(result.debugFile)}: {result.debugFile}
              </span>
            )}
            {result.memoryDebugFile && (
              <span className="font-mono break-all text-center">{t('result.memoryDump')}: {result.memoryDebugFile}</span>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-bg-canvas border border-border-ide rounded-md p-3 flex flex-col shadow-sm mt-2" style={{ fontSize: '11px' }}>
      {/* Header */}
      <div className="flex items-center gap-2 text-text-primary pb-2 mb-2">
        <CheckCircle2 size={12} className="text-emerald-400 shrink-0" />
        <span className="font-semibold text-emerald-400 shrink-0">{result.modifyPlan ? t('result.modifyComplete') : t('result.generateComplete')}</span>
        <span className="opacity-70 ml-1 truncate flex-1 leading-none">{result.statusLabel}</span>
        {onDismiss && (
          <button
            className="text-text-secondary hover:text-text-primary opacity-50 hover:opacity-100 transition-opacity ml-1 shrink-0"
            onClick={onDismiss}
            title={t('result.dismiss')}
          >
            ×
          </button>
        )}
      </div>
      {/* Planner row (create-page) */}
      {result.plannerMetrics && result.plan && (
        <div className="border-t border-border-ide py-2 flex items-center gap-1.5 px-1">
          <span className="text-text-secondary opacity-70 truncate flex-1 leading-none translate-y-[1px]">Planner</span>
          <MetricsBadge durationMs={result.plannerMetrics.durationMs} inputTokens={result.plannerMetrics.inputTokens} outputTokens={result.plannerMetrics.outputTokens} />
          <CheckCircle2 size={10} className="text-emerald-400 shrink-0" />
        </div>
      )}
      {/* Block list (create-page) */}
      {result.plan && (
        <div className="border-t border-border-ide pt-2 pb-1">
          <ul className="flex flex-col gap-1.5 m-0 p-0">
            {result.plan.blocks.map((b) => (
              <OpRow
                key={b.id}
                label={b.description}
                isDone={result.blockStatuses[b.id] === 'done'}
                metrics={{ durationMs: result.blockDurationMs[b.id], inputTokens: result.blockInputTokens[b.id], outputTokens: result.blockOutputTokens[b.id] }}
              />
            ))}
          </ul>
        </div>
      )}
      {/* Modify op list */}
      {result.modifyPlan && (
        <div className="border-t border-border-ide pt-2 pb-1">
          <ul className="flex flex-col gap-1.5 m-0 p-0">
            {Array.from({ length: result.modifyPlan.operationCount }, (_, i) => (
              <OpRow
                key={i}
                label={result.modifyPlan?.operationLabels[i] ?? t('status.operationWithIndex', { index: i + 1 })}
                isDone={result.modifyStatuses[i] === 'done'}
                isError={result.modifyStatuses[i] !== 'done'}
                {...(result.modifyOpMetrics[i] ? { metrics: { durationMs: result.modifyOpMetrics[i].durationMs, inputTokens: result.modifyOpMetrics[i].inputTokens, outputTokens: result.modifyOpMetrics[i].outputTokens } } : {})}
              />
            ))}
          </ul>
        </div>
      )}
      {/* Summary totals */}
      <div className="border-t border-border-ide pt-2 flex items-center gap-2 px-1" style={{ fontSize: '10px', marginTop: '-6px', paddingTop: '8px' }}>
        <span className="text-text-secondary opacity-70 flex-1 leading-none translate-y-[1px]">{t('result.total')}</span>
        <span className="text-text-secondary font-mono tabular-nums leading-none translate-y-[1px]">{(result.elapsedMs / 1000).toFixed(1)}s</span>
        {hasTokenInfo && (
          <span className="text-text-secondary font-mono tabular-nums">In{totalInput} Out{totalOutput}</span>
        )}
        {typeof result.tokensUsed === 'number' && !hasTokenInfo && (
          <span className="text-text-secondary font-mono tabular-nums">{result.tokensUsed}t</span>
        )}
      </div>
      {result.didApplySchema && (
        <div className="border-t border-border-ide pt-2 px-1 text-[10px] text-text-secondary">
          {result.autoSaved ? t('result.fileAutoSaved') : result.autoSaveError ? t('result.autoSaveFailed', { error: result.autoSaveError }) : t('result.pageChangesApplied')}
        </div>
      )}
      {/* Debug metadata */}
      {(typeof result.durationMs === 'number' || typeof result.tokensUsed === 'number' || result.debugFile || result.memoryDebugFile) && (
        <div className="text-text-secondary flex flex-col items-center gap-1 opacity-50 pt-2" style={{ fontSize: '10px' }}>
          {(typeof result.durationMs === 'number' || typeof result.tokensUsed === 'number') && (
            <div className="flex justify-center gap-4">
              {typeof result.durationMs === 'number' && (
                <span>{t('result.duration')}: {result.durationMs}ms</span>
              )}
              {typeof result.tokensUsed === 'number' && (
                <span>{t('result.tokens')}: {result.tokensUsed}</span>
              )}
            </div>
          )}
          {result.debugFile && (
            <span className="font-mono break-all text-center">
              {getDebugFileLabel(result.debugFile)}: {result.debugFile}
            </span>
          )}
          {result.memoryDebugFile && (
            <span className="font-mono break-all text-center">{t('result.memoryDump')}: {result.memoryDebugFile}</span>
          )}
        </div>
      )}
    </div>
  );
}
