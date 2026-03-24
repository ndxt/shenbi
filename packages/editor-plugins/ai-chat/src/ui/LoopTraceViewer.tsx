import React from 'react';
import { ChevronDown, ChevronRight, FileCode2 } from 'lucide-react';
import { useTranslation } from '@shenbi/i18n';
import type { ReActStep } from '../ai/api-types';

export interface LoopTraceViewerProps {
  steps: ReActStep[];
}

export function LoopTraceViewer({ steps }: LoopTraceViewerProps) {
  const { t } = useTranslation('pluginAiChat');
  const [expanded, setExpanded] = React.useState(false);

  if (steps.length === 0) {
    return null;
  }

  return (
    <section className="bg-bg-canvas border border-border-ide rounded-md p-3 flex flex-col gap-2 shadow-sm">
      <button
        type="button"
        className="flex items-center justify-between gap-2 text-left"
        onClick={() => setExpanded((value) => !value)}
      >
        <div className="flex items-center gap-2 text-text-primary">
          <FileCode2 size={14} className="text-primary" />
          <span className="font-semibold" style={{ fontSize: '12px' }}>{t('loop.traceViewerTitle')}</span>
        </div>
        <span className="text-text-secondary flex items-center gap-1" style={{ fontSize: '10px' }}>
          {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          {expanded ? t('loop.hideTrace') : t('loop.showTrace')}
        </span>
      </button>

      {expanded && (
        <pre className="m-0 rounded-md bg-bg-panel/70 border border-border-ide p-3 overflow-auto text-text-primary font-mono whitespace-pre-wrap break-all" style={{ fontSize: '10px', maxHeight: '260px' }}>
          {JSON.stringify(steps, null, 2)}
        </pre>
      )}
    </section>
  );
}
