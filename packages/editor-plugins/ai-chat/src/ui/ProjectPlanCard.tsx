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
      return 'text-blue-500 bg-blue-500/10 border-blue-500/20';
    case 'modify':
      return 'text-amber-400 bg-amber-400/10 border-amber-400/20';
    default:
      return 'text-text-secondary bg-bg-panel border-border-ide';
  }
}

function getProgressClass(status: AgentLoopPageProgress['status']): string {
  switch (status) {
    case 'done':
      return 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20';
    case 'running':
      return 'text-blue-500 bg-blue-500/10 border-blue-500/20';
    case 'failed':
      return 'text-red-400 bg-red-400/10 border-red-400/20';
    case 'skipped':
      return 'text-text-secondary bg-bg-panel border-border-ide';
    default:
      return 'text-text-secondary bg-bg-panel border-border-ide';
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
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-text-primary">
          <ClipboardList size={14} className="text-blue-500" />
          <span className="font-semibold" style={{ fontSize: '12px' }}>{t('loop.planTitle')}</span>
        </div>
        <span className="text-text-secondary font-mono tabular-nums" style={{ fontSize: '10px' }}>
          {t('loop.pageCount', { count: projectPlan.pages.length })}
        </span>
      </div>

      <div className="rounded-md bg-bg-panel/70 border border-border-ide px-3 py-2">
        <div className="text-text-primary font-semibold" style={{ fontSize: '12px' }}>
          {projectPlan.projectName}
        </div>
        {!awaitingConfirmation && (
          <div className="text-text-secondary mt-1" style={{ fontSize: '11px' }}>
            {t('loop.planConfirmed')}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2">
        {projectPlan.pages.map((page) => {
          const pageProgress = pageProgressMap.get(page.pageId);
          return (
          <div key={page.pageId} className="rounded-md border border-border-ide bg-bg-panel/70 px-3 py-2 flex flex-col gap-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-text-primary" style={{ fontSize: '12px' }}>{page.pageName}</span>
              {awaitingConfirmation ? (
                <span className={`px-1.5 py-0.5 rounded border uppercase tracking-wider ${getActionClass(page.action)}`} style={{ fontSize: '10px' }}>
                  {page.action}
                </span>
              ) : pageProgress ? (
                <span className={`px-1.5 py-0.5 rounded border uppercase tracking-wider ${getProgressClass(pageProgress.status)}`} style={{ fontSize: '10px' }}>
                  {pageProgress.status}
                </span>
              ) : null}
              <code className="text-text-secondary" style={{ fontSize: '10px' }}>{page.pageId}</code>
              {!awaitingConfirmation && pageProgress?.fileId && (
                <span className="text-text-secondary" style={{ fontSize: '10px' }}>
                  {t('loop.fileIdLabel')}: <code>{pageProgress.fileId}</code>
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
        <div className="rounded-md border border-border-ide bg-bg-panel/70 px-2.5 py-2">
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
                style={{ fontSize: '12px' }}
              />
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="px-3 py-1.5 rounded-md bg-blue-500 text-white text-[11px] font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={!revisionText.trim()}
                  onClick={() => onSubmitRevision(revisionText)}
                >
                  {t('loop.submitRevision')}
                </button>
                <button
                  type="button"
                  className="px-3 py-1.5 rounded-md border border-border-ide text-text-secondary text-[11px]"
                  onClick={onCancelRevision}
                >
                  {t('loop.cancelRevision')}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <div className="min-w-0 flex-1 text-text-secondary leading-tight" style={{ fontSize: '11px' }}>
                {t('loop.planAwaitingConfirm')}
              </div>
              <div className="ml-auto flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  className="h-6 px-2.5 rounded border border-blue-400/40 bg-blue-500 text-white text-[11px] font-semibold inline-flex items-center justify-center whitespace-nowrap transition-colors hover:bg-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400/60"
                  onClick={onConfirm}
                >
                  <span className="leading-none">{t('loop.confirmPlan')}</span>
                </button>
                <button
                  type="button"
                  className="h-6 px-2.5 rounded border border-border-ide bg-bg-canvas/70 text-text-secondary text-[11px] font-medium inline-flex items-center justify-center whitespace-nowrap transition-colors hover:border-blue-500/40 hover:text-text-primary focus:outline-none focus:ring-1 focus:ring-blue-400/40"
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
