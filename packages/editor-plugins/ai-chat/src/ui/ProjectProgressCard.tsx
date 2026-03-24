import React, { useEffect, useRef } from 'react';
import { FileStack } from 'lucide-react';
import { useTranslation } from '@shenbi/i18n';
import type { AgentLoopPageProgress } from '../ai/agent-loop-types';
import { PageExecutionDetails } from './PageExecutionDetails';

export interface ProjectProgressCardProps {
  pages: AgentLoopPageProgress[];
}

function getStatusClass(status: AgentLoopPageProgress['status']): string {
  switch (status) {
    case 'done':
      return 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20';
    case 'running':
      return 'text-primary bg-primary/10 border-primary/20';
    case 'failed':
      return 'text-red-400 bg-red-400/10 border-red-400/20';
    case 'skipped':
      return 'text-text-secondary bg-bg-panel border-border-ide';
    default:
      return 'text-text-secondary bg-bg-panel border-border-ide';
  }
}

export function ProjectProgressCard({ pages }: ProjectProgressCardProps) {
  const { t } = useTranslation('pluginAiChat');
  const runningRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to the running page item
  const runningPageId = pages.find((p) => p.status === 'running')?.pageId;
  useEffect(() => {
    if (runningRef.current) {
      runningRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [runningPageId]);

  if (pages.length === 0) {
    return null;
  }

  const completedCount = pages.filter((page) => page.status === 'done').length;
  const failedCount = pages.filter((page) => page.status === 'failed').length;

  return (
    <section className="bg-bg-canvas border border-border-ide rounded-md p-3 flex flex-col gap-3 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-text-primary">
          <FileStack size={14} className="text-primary" />
          <span className="font-semibold" style={{ fontSize: '12px' }}>{t('loop.progressTitle')}</span>
        </div>
        <span className="text-text-secondary" style={{ fontSize: '10px' }}>
          {t('loop.progressSummary', { done: completedCount, total: pages.length, failed: failedCount })}
        </span>
      </div>

      <div className="flex flex-col gap-2">
        {pages.map((page) => (
          <div
            key={page.pageId}
            ref={page.status === 'running' ? runningRef : undefined}
            className="rounded-md border border-border-ide bg-bg-panel/70 p-3 flex flex-col gap-2"
          >
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-text-primary" style={{ fontSize: '12px' }}>{page.pageName}</span>
              <span className={`px-1.5 py-0.5 rounded border uppercase tracking-wider ${getStatusClass(page.status)}`} style={{ fontSize: '10px' }}>
                {page.status}
              </span>
              <code className="text-text-secondary" style={{ fontSize: '10px' }}>{page.pageId}</code>
              {page.fileId && (
                <span className="text-text-secondary" style={{ fontSize: '10px' }}>
                  {t('loop.fileIdLabel')}: <code>{page.fileId}</code>
                </span>
              )}
            </div>

            <div className="text-text-secondary whitespace-pre-wrap" style={{ fontSize: '11px' }}>{page.description}</div>

            {page.execution && (
              <PageExecutionDetails
                snapshot={page.execution}
                variant="embedded"
                isRunning={page.status === 'running'}
              />
            )}

            {page.error && (
              <div className="rounded bg-red-500/10 border border-red-500/20 px-2 py-1.5 text-red-400" style={{ fontSize: '11px' }}>
                {page.error}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
