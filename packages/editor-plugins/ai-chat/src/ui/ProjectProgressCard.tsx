import React from 'react';
import { CheckCircle2, CircleDashed, FileStack, TriangleAlert } from 'lucide-react';
import { useTranslation } from '@shenbi/i18n';
import type { AgentLoopPageProgress } from '../ai/agent-loop-types';

export interface ProjectProgressCardProps {
  pages: AgentLoopPageProgress[];
}

function getStatusClass(status: AgentLoopPageProgress['status']): string {
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

function blockStatusLabel(status: 'waiting' | 'generating' | 'done' | 'failed') {
  switch (status) {
    case 'generating':
      return '...';
    case 'done':
      return 'done';
    case 'failed':
      return 'failed';
    default:
      return 'wait';
  }
}

export function ProjectProgressCard({ pages }: ProjectProgressCardProps) {
  const { t } = useTranslation('pluginAiChat');

  if (pages.length === 0) {
    return null;
  }

  const completedCount = pages.filter((page) => page.status === 'done').length;
  const failedCount = pages.filter((page) => page.status === 'failed').length;

  return (
    <section className="bg-bg-canvas border border-border-ide rounded-md p-3 flex flex-col gap-3 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-text-primary">
          <FileStack size={14} className="text-blue-500" />
          <span className="font-semibold" style={{ fontSize: '12px' }}>{t('loop.progressTitle')}</span>
        </div>
        <span className="text-text-secondary" style={{ fontSize: '10px' }}>
          {t('loop.progressSummary', { done: completedCount, total: pages.length, failed: failedCount })}
        </span>
      </div>

      <div className="flex flex-col gap-2">
        {pages.map((page) => (
          <div key={page.pageId} className="rounded-md border border-border-ide bg-bg-panel/70 p-3 flex flex-col gap-2">
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

            {page.blocks.length > 0 && (
              <div className="grid grid-cols-1 gap-1">
                {page.blocks.map((block) => (
                  <div key={block.id} className="rounded bg-bg-canvas px-2 py-1.5 flex items-center gap-2">
                    {block.status === 'done' ? (
                      <CheckCircle2 size={11} className="text-emerald-400 shrink-0" />
                    ) : block.status === 'failed' ? (
                      <TriangleAlert size={11} className="text-red-400 shrink-0" />
                    ) : (
                      <CircleDashed size={11} className={`shrink-0 ${block.status === 'generating' ? 'text-blue-500 animate-spin' : 'text-text-secondary'}`} />
                    )}
                    <span className="text-text-primary flex-1 truncate" style={{ fontSize: '11px' }} title={block.label}>{block.label}</span>
                    <span className="text-text-secondary font-mono uppercase" style={{ fontSize: '10px' }}>{blockStatusLabel(block.status)}</span>
                  </div>
                ))}
              </div>
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
