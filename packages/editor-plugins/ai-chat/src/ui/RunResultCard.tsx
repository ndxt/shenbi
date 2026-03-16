import React from 'react';
import { CheckCircle2 } from 'lucide-react';
import { useTranslation } from '@shenbi/i18n';
import type { LastRunResult } from '../hooks/useAgentRun';
import { createPageExecutionSnapshot } from '../ai/page-execution';
import { PageExecutionDetails, summarizeExecutionTokens } from './PageExecutionDetails';
import { ProjectPlanCard } from './ProjectPlanCard';

export interface RunResultCardProps {
  result: LastRunResult;
  onDismiss?: (() => void) | undefined;
}

function getStandaloneSnapshot(result: LastRunResult) {
  if (result.pageExecution) {
    return result.pageExecution;
  }
  const mode = result.modifyPlan ? 'modify' : 'create';
  return {
    ...createPageExecutionSnapshot(mode),
    plan: result.plan,
    plannerMetrics: result.plannerMetrics,
    blockStatuses: result.blockStatuses,
    blockTokens: result.blockTokens,
    blockInputTokens: result.blockInputTokens,
    blockOutputTokens: result.blockOutputTokens,
    blockDurationMs: result.blockDurationMs,
    modifyPlan: result.modifyPlan,
    modifyStatuses: result.modifyStatuses,
    modifyOpMetrics: result.modifyOpMetrics,
    progressText: result.statusLabel,
    didApplySchema: result.didApplySchema,
  };
}

export function RunResultCard({ result, onDismiss }: RunResultCardProps) {
  const { t } = useTranslation('pluginAiChat');
  const standaloneSnapshot = getStandaloneSnapshot(result);
  const { totalInput, totalOutput } = summarizeExecutionTokens(standaloneSnapshot);
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
      <PageExecutionDetails snapshot={standaloneSnapshot} variant="standalone" />
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
