import React from 'react';
import { ClipboardList } from 'lucide-react';
import { useTranslation } from '@shenbi/i18n';
import type { ProjectPlan } from '../ai/api-types';
import type { AgentLoopPageProgress, UIPhase } from '../ai/agent-loop-types';

export interface ProjectPlanCardProps {
  projectPlan: ProjectPlan | null;
  pages?: AgentLoopPageProgress[] | undefined;
  phase: UIPhase;
  planRevisionRequested: boolean;
  onConfirm: () => void;
  onRequestRevision: () => void;
  onCancelRevision: () => void;
  onSubmitRevision: (text: string) => void;
}

function getActionClass(action: 'create' | 'modify' | 'skip'): string {
  switch (action) {
    case 'create':
      return 'text-blue-500 border border-blue-500/30 bg-blue-500/10 shadow-sm';
    case 'modify':
      return 'text-amber-500 border border-amber-500/30 bg-amber-500/10 shadow-sm';
    default:
      return 'text-text-secondary bg-bg-panel border border-border-ide';
  }
}

function getProgressClass(status: AgentLoopPageProgress['status']): string {
  switch (status) {
    case 'done':
      return 'text-emerald-500 border border-emerald-500/30 bg-emerald-500/10 shadow-sm';
    case 'running':
      return 'text-blue-500 border border-blue-500/30 bg-blue-500/10 shadow-sm';
    case 'failed':
      return 'text-red-500 border border-red-500/30 bg-red-500/10 shadow-sm';
    case 'skipped':
      return 'text-text-secondary bg-bg-panel border border-border-ide';
    default:
      return 'text-text-secondary bg-bg-panel';
  }
}

export function ProjectPlanCard({
  projectPlan,
  pages,
  phase,
  planRevisionRequested,
  onConfirm,
  onRequestRevision,
  onCancelRevision,
  onSubmitRevision,
}: ProjectPlanCardProps) {
  const { t } = useTranslation('pluginAiChat');
  const [revisionText, setRevisionText] = React.useState('');

  React.useEffect(() => {
    if (!planRevisionRequested) {
      setRevisionText('');
    }
  }, [planRevisionRequested]);

  if (!projectPlan) {
    return null;
  }

  const awaitingConfirmation = phase === 'awaiting_confirmation';
  const pageProgressMap = new Map((pages ?? []).map((page) => [page.pageId, page]));

  return (
    <section className="bg-bg-canvas border border-border-ide rounded-md p-3 flex flex-col gap-3 shadow-sm">
      <div className="flex items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="flex items-center gap-2 shrink-0">
            <ClipboardList size={14} className="text-blue-500" />
            <span className="font-semibold text-text-primary" style={{ fontSize: '12px' }}>{t('loop.planTitle')}</span>
          </div>
          <span className="text-text-primary font-medium truncate shrink-0" style={{ fontSize: '12px' }}>
            {projectPlan.projectName}
          </span>
          {!awaitingConfirmation && (
            <span className="text-text-secondary shrink-0" style={{ fontSize: '11px' }}>
              ({t('loop.planConfirmed')})
            </span>
          )}
        </div>
        <span className="text-text-secondary font-mono tabular-nums shrink-0" style={{ fontSize: '10px' }}>
          {t('loop.pageCount', { count: projectPlan.pages.length })}
        </span>
      </div>

      <div className="flex flex-col gap-2">
        {projectPlan.pages.map((page) => {
          const pageProgress = pageProgressMap.get(page.pageId);
          return (
          <div key={page.pageId} className="group rounded-md border border-border-ide bg-bg-panel/70 px-3 py-2 flex flex-col gap-1.5 transition-colors hover:bg-bg-panel hover:border-blue-500/30">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-text-primary" style={{ fontSize: '13px' }}>{page.pageName}</span>
              {awaitingConfirmation ? (
                <span className={`px-1.5 py-0.5 rounded uppercase tracking-wider font-medium ${getActionClass(page.action)}`} style={{ fontSize: '10px' }}>
                  {page.action}
                </span>
              ) : pageProgress ? (
                <span className={`px-1.5 py-0.5 rounded uppercase tracking-wider font-medium ${getProgressClass(pageProgress.status)}`} style={{ fontSize: '10px' }}>
                  {pageProgress.status}
                </span>
              ) : null}
              <span className="text-text-secondary font-mono" style={{ fontSize: '11px' }}>{page.pageId}</span>
              {!awaitingConfirmation && pageProgress?.fileId && (
                <span className="text-text-secondary ml-1" style={{ fontSize: '11px' }}>
                  {t('loop.fileIdLabel')}: <span className="font-mono">{pageProgress.fileId}</span>
                </span>
              )}
            </div>
            <div className="text-text-secondary whitespace-pre-wrap" style={{ fontSize: '11px' }}>{page.description}</div>
            {page.reason && (
              <div className="text-text-secondary/80" style={{ fontSize: '10px' }}>
                {t('loop.reasonLabel')}: {page.reason}
              </div>
            )}
            {!awaitingConfirmation && pageProgress?.error && (
              <div className="rounded bg-red-500/10 border border-red-500/20 px-2 py-1.5 text-red-400" style={{ fontSize: '11px' }}>
                {pageProgress.error}
              </div>
            )}
          </div>
        )})}
      </div>

      {awaitingConfirmation && (
        <div className="px-1 py-1 mt-1">
          {planRevisionRequested ? (
            <div className="flex flex-col gap-2">
              <label className="text-text-primary font-semibold" style={{ fontSize: '11px' }}>
                {t('loop.revisionLabel')}
              </label>
              <textarea
                value={revisionText}
                onChange={(event) => setRevisionText(event.target.value)}
                placeholder={t('loop.revisionPlaceholder')}
                rows={3}
                className="w-full rounded-md border border-border-ide bg-bg-canvas px-2 py-1.5 text-text-primary resize-y outline-none focus:border-blue-500"
                style={{ fontSize: '11px' }}
              />
              <div className="flex items-center gap-2 mt-1">
                <button
                  type="button"
                  className="px-2.5 py-1 rounded bg-blue-500 text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors hover:bg-blue-400"
                  style={{ fontSize: '10px' }}
                  disabled={!revisionText.trim()}
                  onClick={() => onSubmitRevision(revisionText)}
                >
                  {t('loop.submitRevision')}
                </button>
                <button
                  type="button"
                  className="px-2.5 py-1 rounded border border-border-ide text-text-secondary font-medium transition-colors hover:border-blue-500/40 hover:text-text-primary"
                  style={{ fontSize: '10px' }}
                  onClick={onCancelRevision}
                >
                  {t('loop.cancelRevision')}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <div className="text-text-primary leading-relaxed min-w-0 pr-2" style={{ fontSize: '12px' }}>
                {t('loop.planAwaitingConfirm')}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  className="h-6 px-3 rounded border border-transparent bg-blue-500 text-white font-medium inline-flex items-center justify-center whitespace-nowrap transition-colors hover:bg-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400/60"
                  style={{ fontSize: '11px' }}
                  onClick={onConfirm}
                >
                  <span className="leading-none">{t('loop.confirmPlan')}</span>
                </button>
                <button
                  type="button"
                  className="h-6 px-3 rounded border border-border-ide bg-transparent text-text-primary font-medium inline-flex items-center justify-center whitespace-nowrap transition-colors hover:bg-bg-canvas/50 hover:border-text-secondary/50 focus:outline-none"
                  style={{ fontSize: '11px' }}
                  onClick={onRequestRevision}
                >
                  <span className="leading-none">{t('loop.requestRevision')}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
