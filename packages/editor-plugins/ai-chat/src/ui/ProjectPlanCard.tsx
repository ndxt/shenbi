import React from 'react';
import { CheckCircle2, ClipboardList, PencilLine } from 'lucide-react';
import { useTranslation } from '@shenbi/i18n';
import type { ProjectPlan } from '../ai/api-types';
import type { UIPhase } from '../ai/agent-loop-types';

export interface ProjectPlanCardProps {
  projectPlan: ProjectPlan | null;
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

export function ProjectPlanCard({
  projectPlan,
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
        <div className="text-text-secondary mt-1" style={{ fontSize: '11px' }}>
          {awaitingConfirmation ? t('loop.planAwaitingConfirm') : t('loop.planConfirmed')}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {projectPlan.pages.map((page) => (
          <div key={page.pageId} className="rounded-md border border-border-ide bg-bg-panel/70 px-3 py-2 flex flex-col gap-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-text-primary" style={{ fontSize: '12px' }}>{page.pageName}</span>
              <span className={`px-1.5 py-0.5 rounded border uppercase tracking-wider ${getActionClass(page.action)}`} style={{ fontSize: '10px' }}>
                {page.action}
              </span>
              <code className="text-text-secondary" style={{ fontSize: '10px' }}>{page.pageId}</code>
            </div>
            <div className="text-text-secondary whitespace-pre-wrap" style={{ fontSize: '11px' }}>{page.description}</div>
            {page.reason && (
              <div className="text-text-secondary/80" style={{ fontSize: '10px' }}>
                {t('loop.reasonLabel')}: {page.reason}
              </div>
            )}
          </div>
        ))}
      </div>

      {awaitingConfirmation && (
        <div className="rounded-md border border-border-ide bg-bg-panel/70 p-3 flex flex-col gap-2">
          {planRevisionRequested ? (
            <>
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
            </>
          ) : (
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                className="px-3 py-1.5 rounded-md bg-emerald-500 text-white text-[11px] font-semibold inline-flex items-center gap-1.5"
                onClick={onConfirm}
              >
                <CheckCircle2 size={12} />
                {t('loop.confirmPlan')}
              </button>
              <button
                type="button"
                className="px-3 py-1.5 rounded-md border border-border-ide text-text-secondary text-[11px] inline-flex items-center gap-1.5"
                onClick={onRequestRevision}
              >
                <PencilLine size={12} />
                {t('loop.requestRevision')}
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
