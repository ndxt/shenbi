import React from 'react';
import { Bot, CheckCircle2, ChevronDown, ChevronRight, CircleDashed, Wrench } from 'lucide-react';
import { useTranslation } from '@shenbi/i18n';
import type { ReActStep } from '../ai/api-types';

export interface ReActStepListProps {
  steps: ReActStep[];
  isRunning?: boolean;
}

function formatJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function compactText(value: string | undefined, fallback: string): string {
  const normalized = (value ?? '').replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return fallback;
  }
  return normalized.length > 120 ? `${normalized.slice(0, 117)}...` : normalized;
}

export function ReActStepList({ steps, isRunning = false }: ReActStepListProps) {
  const { t } = useTranslation('pluginAiChat');
  const [expandedStepKeys, setExpandedStepKeys] = React.useState<Record<string, boolean>>({});

  if (steps.length === 0) {
    return null;
  }

  return (
    <section className="bg-bg-canvas border border-border-ide rounded-md p-3 flex flex-col gap-3 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-text-primary">
          <Bot size={14} className="text-primary" />
          <span className="font-semibold" style={{ fontSize: '12px' }}>{t('loop.traceTitle')}</span>
        </div>
        <span className="text-text-secondary font-mono tabular-nums" style={{ fontSize: '10px' }}>
          {t('loop.stepCount', { count: steps.length })}
        </span>
      </div>

      <div className="flex flex-col gap-2">
        {steps.map((step, index) => (
          <div key={`${step.timestamp}-${step.stepIndex}`} className="border border-border-ide rounded-md bg-bg-panel/70 p-2.5 flex flex-col gap-2">
            {(() => {
              const stepKey = `${step.timestamp}-${step.stepIndex}`;
              const expanded = expandedStepKeys[stepKey] ?? Boolean(step.error || (!step.observation && isRunning && index === steps.length - 1));
              const observationPreview = compactText(
                step.error ?? step.observation,
                step.error ? t('loop.stepFailed') : t('loop.waitingObservation'),
              );
              const inputPreview = compactText(formatJson(step.actionInput), '{}');

              return (
                <>
                  <div className="flex items-start gap-2">
              <div className="w-6 h-6 rounded-full bg-primary/10 text-primary border border-primary/20 flex items-center justify-center shrink-0">
                <Wrench size={12} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-text-primary" style={{ fontSize: '12px' }}>
                    {t('loop.stepLabel', { index: index + 1 })}
                  </span>
                  <code className="px-1.5 py-0.5 rounded bg-bg-canvas text-primary" style={{ fontSize: '11px' }}>
                    {step.action}
                  </code>
                  {step.error ? (
                    <span className="text-red-400" style={{ fontSize: '11px' }}>{t('loop.stepFailed')}</span>
                  ) : step.observation ? (
                    <span className="text-emerald-400 flex items-center gap-1" style={{ fontSize: '11px' }}>
                      <CheckCircle2 size={11} />
                      {t('loop.stepDone')}
                    </span>
                  ) : isRunning && index === steps.length - 1 ? (
                    <span className="text-primary flex items-center gap-1" style={{ fontSize: '11px' }}>
                      <CircleDashed size={11} className="animate-spin" />
                      {t('loop.stepRunning')}
                    </span>
                  ) : null}
                </div>
                <div className="text-text-secondary mt-1 flex flex-col gap-1" style={{ fontSize: '11px' }}>
                  {(step.status || step.reasoningSummary) && (
                    <div className="whitespace-pre-wrap">
                      {step.status ?? step.reasoningSummary}
                    </div>
                  )}
                  <div className="grid grid-cols-1 gap-1 text-[10px] text-text-secondary/90">
                    <div>
                      <span className="uppercase tracking-wider opacity-70">Input</span>
                      {' '}
                      <code className="text-text-primary/85">{inputPreview}</code>
                    </div>
                    <div>
                      <span className="uppercase tracking-wider opacity-70">{step.error ? t('loop.error') : t('loop.observation')}</span>
                      {' '}
                      <span className={step.error ? 'text-red-400' : 'text-text-primary/85'}>{observationPreview}</span>
                    </div>
                  </div>
                </div>
              </div>
              <button
                type="button"
                className="shrink-0 rounded border border-border-ide bg-bg-canvas px-1.5 py-1 text-text-secondary hover:text-text-primary"
                onClick={() => setExpandedStepKeys((previous) => ({ ...previous, [stepKey]: !expanded }))}
                aria-label={expanded ? 'Collapse step details' : 'Expand step details'}
                title={expanded ? 'Collapse step details' : 'Expand step details'}
              >
                {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              </button>
            </div>

            {expanded && (
              <div className="grid grid-cols-1 gap-2 xl:grid-cols-2">
                <div className="rounded bg-bg-canvas px-2 py-1.5">
                  <div className="text-text-secondary uppercase tracking-wider mb-1" style={{ fontSize: '10px' }}>
                    {t('loop.actionInput')}
                  </div>
                  <pre className="m-0 whitespace-pre-wrap break-all text-text-primary font-mono overflow-auto" style={{ fontSize: '10px', maxHeight: '140px' }}>
                    {formatJson(step.actionInput)}
                  </pre>
                </div>
                <div className="rounded bg-bg-canvas px-2 py-1.5">
                  <div className="text-text-secondary uppercase tracking-wider mb-1" style={{ fontSize: '10px' }}>
                    {step.error ? t('loop.error') : t('loop.observation')}
                  </div>
                  <pre className={`m-0 whitespace-pre-wrap break-all font-mono overflow-auto ${step.error ? 'text-red-400' : 'text-text-primary'}`} style={{ fontSize: '10px', maxHeight: '140px' }}>
                    {step.error ?? step.observation ?? t('loop.waitingObservation')}
                  </pre>
                </div>
              </div>
            )}
                </>
              );
            })()}
          </div>
        ))}
      </div>
    </section>
  );
}
