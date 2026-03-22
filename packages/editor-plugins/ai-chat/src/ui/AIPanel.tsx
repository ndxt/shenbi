import React, { useEffect, useRef, useMemo } from 'react';
import { Sparkles, Trash2, LoaderCircle } from 'lucide-react';
import {
  getPluginCommandAccess,
  type PluginContext,
} from '@shenbi/editor-plugin-api';
import { useTranslation } from '@shenbi/i18n';
import type { EditorAIBridge } from '../ai/editor-ai-bridge';
import { createPendingAttachment, materializePendingAttachments, type PendingAttachment } from '../attachments';
import { useModels } from '../hooks/useModels';
import { useChatSession } from '../hooks/useChatSession';
import { useAgentLoop } from '../hooks/useAgentLoop';
import { ChatMessageList } from './ChatMessageList';
import { ChatInput, type PromptOption } from './ChatInput';
import { ModelSelector } from './ModelSelector';
import { PageExecutionDetails } from './PageExecutionDetails';
import { ProjectPlanCard } from './ProjectPlanCard';

export interface AIPanelProps {
  bridge?: EditorAIBridge;
  pluginContext?: PluginContext;
  defaultPlannerModel?: string;
  defaultBlockModel?: string;
}

const PERSISTENCE_NAMESPACE = 'ai-chat';
const UI_PERSISTENCE_KEY = 'ui';
const PROMPT_HISTORY_PERSISTENCE_KEY = 'prompt-history';
const MAX_PROMPT_HISTORY = 12;

// Helper to get prompt presets from i18n
function getPromptPresets(t: (key: string) => string): PromptOption[] {
  return [
    { label: t('presets.workspaceOverview.label'), value: t('presets.workspaceOverview.value') },
    { label: t('presets.masterDetail.label'), value: t('presets.masterDetail.value') },
    { label: t('presets.formOrchestration.label'), value: t('presets.formOrchestration.value') },
    { label: t('presets.listWithDrawer.label'), value: t('presets.listWithDrawer.value') },
    { label: t('presets.multiBlockPortal.label'), value: t('presets.multiBlockPortal.value') },
    { label: t('presets.dataAnalysisDashboard.label'), value: t('presets.dataAnalysisDashboard.value') },
    { label: t('presets.salesTrendCharts.label'), value: t('presets.salesTrendCharts.value') },
    { label: t('presets.kpiProgressMonitor.label'), value: t('presets.kpiProgressMonitor.value') },
  ];
}

export function AIPanel({
  bridge,
  pluginContext,
  defaultPlannerModel,
  defaultBlockModel,
}: AIPanelProps) {
  const { t } = useTranslation('pluginAiChat');
  const persistence = pluginContext?.persistence;
  const commandAccess = useMemo(
    () => getPluginCommandAccess(pluginContext ?? {}),
    [pluginContext],
  );
  const [thinkingEnabled, setThinkingEnabled] = React.useState(false);
  const [blockConcurrency, setBlockConcurrency] = React.useState(3);
  const [draftText, setDraftText] = React.useState('');
  const [pendingAttachments, setPendingAttachments] = React.useState<PendingAttachment[]>([]);
  const [promptHistory, setPromptHistory] = React.useState<string[]>([]);
  const [uiHydrated, setUIHydrated] = React.useState(!persistence);
  const {
    plannerModels,
    plannerModel,
    setPlannerModel,
    blockModels,
    blockModel,
    setBlockModel,
    isLoading: isLoadingModels,
    error: modelsError,
  } = useModels(defaultPlannerModel, defaultBlockModel, persistence);

  const {
    messages,
    addMessage,
    updateMessage,
    dismissRunResult,
    conversationId,
    setConversationId,
    resetSession,
  } = useChatSession(persistence);

  const {
    mode,
    phase,
    isRunning,
    progressText,
    elapsedMs,
    projectPlan,
    pages,
    errorMessage,
    legacy,
    planRevisionRequested,
    runAgent,
    cancelRun,
    resetLoopState,
    confirmProjectPlan,
    requestProjectPlanRevision,
    cancelProjectPlanRevision,
    submitProjectPlanRevision,
  } = useAgentLoop(bridge, persistence);
  const {
    executionSnapshot,
  } = legacy;

  // Memoized prompt presets from i18n
  const promptPresets = useMemo(() => getPromptPresets(t), [t]);

  const [selectedNodeLabel, setSelectedNodeLabel] = React.useState<string>(t('status.notSelected'));
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const modelsReady = plannerModels.length > 0 && blockModels.length > 0;
  const modelSelectionBlocked = isLoadingModels || Boolean(modelsError) || !modelsReady;
  const loopAwaitingConfirmation = mode === 'loop' && phase === 'awaiting_confirmation';
  const showInlineLoopPlan = mode === 'loop' && phase !== 'done';

  useEffect(() => {
    let cancelled = false;
    if (!persistence) {
      setUIHydrated(true);
      return () => {
        cancelled = true;
      };
    }

    void Promise.all([
      persistence.getJSON<{
        thinkingEnabled?: boolean;
        blockConcurrency?: number;
        draftText?: string;
      }>(PERSISTENCE_NAMESPACE, UI_PERSISTENCE_KEY),
      persistence.getJSON<string[]>(PERSISTENCE_NAMESPACE, PROMPT_HISTORY_PERSISTENCE_KEY),
    ])
      .then(([storedUIState, storedPromptHistory]) => {
        if (cancelled) {
          return;
        }
        setThinkingEnabled(Boolean(storedUIState?.thinkingEnabled));
        if (typeof storedUIState?.blockConcurrency === 'number') {
          setBlockConcurrency(Math.min(8, Math.max(1, storedUIState.blockConcurrency)));
        }
        setDraftText(storedUIState?.draftText ?? '');
        setPromptHistory(storedPromptHistory ?? []);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) {
          setUIHydrated(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [persistence]);

  useEffect(() => {
    if (!bridge) return;
    return bridge.subscribe((snapshot) => {
      setSelectedNodeLabel(snapshot.selectedNodeId ?? t('status.notSelected'));
    });
  }, [bridge, t]);

  useEffect(() => {
    const target = messagesEndRef.current;
    if (!target || typeof target.scrollIntoView !== 'function') {
      return;
    }
    target.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, progressText, phase, pages]);

  useEffect(() => {
    if (!persistence || !uiHydrated) {
      return;
    }

    void persistence
      .setJSON(PERSISTENCE_NAMESPACE, UI_PERSISTENCE_KEY, {
        thinkingEnabled,
        blockConcurrency,
        draftText,
      })
      .catch(() => undefined);
  }, [blockConcurrency, draftText, persistence, thinkingEnabled, uiHydrated]);

  useEffect(() => {
    if (!persistence || !uiHydrated) {
      return;
    }

    void persistence
      .setJSON(PERSISTENCE_NAMESPACE, PROMPT_HISTORY_PERSISTENCE_KEY, promptHistory)
      .catch(() => undefined);
  }, [persistence, promptHistory, uiHydrated]);

  const applyPromptText = React.useCallback((text: string) => {
    setDraftText(text);
  }, []);

  const rememberPrompt = React.useCallback((text: string) => {
    setPromptHistory((previous) => [
      text,
      ...previous.filter((item) => item !== text),
    ].slice(0, MAX_PROMPT_HISTORY));
  }, []);

  const handleRemoveHistory = React.useCallback((value: string) => {
    setPromptHistory((previous) => previous.filter((item) => item !== value));
  }, []);

  const handleClear = React.useCallback(() => {
    if (isRunning) {
      return;
    }
    void resetLoopState();
    resetSession();
    setDraftText('');
    setPendingAttachments([]);
    void commandAccess.execute('workspace.resetDocument');
  }, [commandAccess, isRunning, resetLoopState, resetSession]);

  const handleAddFiles = React.useCallback((files: File[]) => {
    const nextAttachments: PendingAttachment[] = [];
    const unsupportedFiles: string[] = [];

    for (const file of files) {
      const attachment = createPendingAttachment(file);
      if (!attachment) {
        unsupportedFiles.push(file.name);
        continue;
      }
      nextAttachments.push(attachment);
    }

    if (unsupportedFiles.length > 0) {
      addMessage({
        role: 'assistant',
        content: `[Error]: ${t('input.unsupportedFiles', { files: unsupportedFiles.join(', ') })}`,
      });
    }

    if (nextAttachments.length === 0) {
      return;
    }

    setPendingAttachments((previous) => [...previous, ...nextAttachments]);
  }, [addMessage, t]);

  const handleRemoveAttachment = React.useCallback((attachmentId: string) => {
    setPendingAttachments((previous) => previous.filter((attachment) => attachment.id !== attachmentId));
  }, []);

  const handleSend = (text: string) => {
    if (modelSelectionBlocked) {
      addMessage({ role: 'assistant', content: `[Error]: ${modelsError ?? t('model.modelsNotLoaded')}` });
      return;
    }

    void (async () => {
      const currentConvId = conversationId ?? `conv-${Date.now()}`;
      const userText = text.trim();
      const requestPrompt = userText || t('input.attachmentOnlyPrompt');
      if (!conversationId) setConversationId(currentConvId);

      try {
        const { runAttachments, refs } = await materializePendingAttachments(pendingAttachments);
        addMessage({
          role: 'user',
          content: userText,
          ...(refs.length > 0 ? { attachments: refs } : {}),
        });
        if (userText) {
          rememberPrompt(userText);
        }
        setDraftText('');
        setPendingAttachments([]);

        await runAgent(
          requestPrompt,
          plannerModel,
          blockModel,
          thinkingEnabled,
          currentConvId,
          () => addMessage({ role: 'assistant', content: '' }),
          (id, chunk) => updateMessage(id, (prev) => prev + chunk),
          () => { /* metadata now stored in runResult message */ },
          (err) => {
            addMessage({ role: 'assistant', content: `[Error]: ${err}` });
          },
          blockConcurrency,
          (result) => {
            addMessage({ role: 'system', content: '', runResult: result });
          },
          runAttachments,
        );
      } catch (error) {
        addMessage({
          role: 'assistant',
          content: `[Error]: ${error instanceof Error ? error.message : t('input.attachmentReadFailed')}`,
        });
      }
    })();
  };

  return (
    <>
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes shimmer { 0%, 100% { opacity: 0.5; } 50% { opacity: 1; } }
      `}</style>
      <div className="w-full h-full bg-bg-panel border-l border-border-ide flex flex-col shrink-0 overflow-hidden">
        <div className="h-9 px-4 border-b border-border-ide flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 text-text-primary">
            <Sparkles size={14} className="text-blue-500" />
            <span className="font-bold uppercase tracking-wider" style={{ fontSize: '11px' }}>{t('panel.title')}</span>
          </div>
          <button
            type="button"
            className="rounded p-1.5 text-text-secondary transition-colors hover:bg-bg-canvas hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-50"
            onClick={handleClear}
            disabled={isRunning}
            aria-label={t('panel.clearAriaLabel')}
            title={t('panel.clearTooltip')}
          >
            <span className="flex items-center gap-1">
              <Trash2 size={13} />
              <span>{t('panel.clear')}</span>
            </span>
          </button>
        </div>

        <div className="flex-none px-3 py-2 border-b border-border-ide flex gap-3 bg-bg-panel items-center justify-between">
          <div className="flex gap-2 flex-1">
            <ModelSelector label="Planner" models={plannerModels} value={plannerModel} onChange={(value) => {
              setPlannerModel(value);
              setBlockModel(value);
            }} disabled={isRunning || modelSelectionBlocked} />
            <ModelSelector label="Block" models={blockModels} value={blockModel} onChange={setBlockModel} disabled={isRunning || modelSelectionBlocked} />
          </div>
          <label className="flex items-center gap-1.5 cursor-pointer select-none shrink-0" title={t('settings.thinking')}>
            <span className="text-text-secondary uppercase tracking-wider" style={{ fontSize: '10px' }}>{t('settings.thinking')}</span>
            <div className={`relative inline-flex h-[18px] w-8 shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors duration-200 ease-in-out focus:outline-none ${thinkingEnabled ? 'bg-blue-500' : 'bg-bg-canvas border border-border-ide'}`}>
              <span className={`pointer-events-none inline-block h-[12px] w-[12px] transform rounded-full shadow transition duration-200 ease-in-out ${thinkingEnabled ? 'bg-white translate-x-1.5' : 'bg-text-secondary -translate-x-1.5'}`} />
            </div>
            <input
              type="checkbox"
              className="sr-only"
              checked={thinkingEnabled}
              onChange={(e) => setThinkingEnabled(e.target.checked)}
              disabled={isRunning || modelSelectionBlocked}
            />
          </label>
        </div>

        <div className="flex-none px-3 py-1.5 border-b border-border-ide bg-bg-panel flex items-center gap-2">
          <span className="text-text-secondary uppercase tracking-wider shrink-0" style={{ fontSize: '10px' }}>{t('settings.concurrency')}</span>
          <input
            type="range"
            min={1}
            max={8}
            step={1}
            value={blockConcurrency}
            onChange={(e) => setBlockConcurrency(Number(e.target.value))}
            disabled={isRunning}
            className="flex-1 accent-blue-500 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ height: '4px' }}
            title={`${t('settings.concurrency')}: ${blockConcurrency}`}
          />
          <span className="text-text-primary font-mono shrink-0 w-4 text-center" style={{ fontSize: '11px' }}>{blockConcurrency}</span>
        </div>

        {isLoadingModels && (
          <div className="px-4 py-2 text-text-secondary border-b border-border-ide bg-bg-panel" style={{ fontSize: '11px' }}>
            {t('model.loadingModels')}
          </div>
        )}

        {modelsError && (
          <div className="px-4 py-2 text-red-400 border-b border-border-ide bg-bg-panel" style={{ fontSize: '11px' }}>
            {t('model.loadModelsFailed', { error: modelsError })}
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-4 pt-4 pb-10 flex flex-col gap-6">
          {messages.length === 0 && (
            <div className="text-text-secondary text-center py-10 opacity-60 whitespace-pre-line" style={{ fontSize: '12px' }}>
              {t('message.welcome')}
            </div>
          )}

          <ChatMessageList messages={messages} onDismissRunResult={dismissRunResult} />

          {mode !== 'loop' && isRunning && (
            <div className="bg-bg-canvas border border-border-ide rounded-md p-3 flex w-full min-w-0 self-stretch flex-col shadow-sm relative overflow-hidden mt-2">
              <div className="absolute top-0 left-0 h-[2px] bg-gradient-to-r from-blue-500 via-indigo-400 to-blue-500 animate-[shimmer_1.5s_ease-in-out_infinite] w-full" />
              <div className="flex items-start gap-2 text-text-primary pb-2 mb-2" style={{ fontSize: '11px' }}>
                <LoaderCircle size={12} className="text-blue-500 shrink-0 mt-0.5" style={{ animation: 'spin 1s linear infinite' }} />
                <span className="font-semibold text-blue-500 shrink-0 leading-5">{t('status.generating')}</span>
                <span className="opacity-70 ml-1 flex-1 min-w-0 whitespace-pre-wrap break-words leading-5">{progressText}</span>
                <span className="text-text-secondary font-mono shrink-0 tabular-nums leading-5 pt-0.5" style={{ fontSize: '10px' }}>
                  {Math.floor(elapsedMs / 1000)}s
                </span>
              </div>
              <PageExecutionDetails
                snapshot={executionSnapshot}
                variant="standalone"
                isRunning
              />
            </div>
          )}

          {showInlineLoopPlan && (
            <ProjectPlanCard
              projectPlan={projectPlan}
              pages={pages}
              phase={phase}
              progressText={progressText}
              elapsedMs={elapsedMs}
              errorMessage={errorMessage}
              planRevisionRequested={planRevisionRequested}
              onConfirm={confirmProjectPlan}
              onRequestRevision={requestProjectPlanRevision}
              onCancelRevision={cancelProjectPlanRevision}
              onSubmitRevision={submitProjectPlanRevision}
            />
          )}



          <div ref={messagesEndRef} className="h-8 shrink-0" />
        </div>

        <div className="border-t border-border-ide shrink-0 bg-bg-panel flex flex-col gap-2" style={{ padding: '8px' }}>
          <div className="text-text-secondary flex justify-between px-1" style={{ fontSize: '11px' }}>
            <span>{t('status.selected', { label: selectedNodeLabel })}</span>
            {!bridge && <span className="text-red-400">{t('status.bridgeDisconnected')}</span>}
          </div>
          <ChatInput
            onSend={handleSend}
            onCancel={cancelRun}
            isRunning={isRunning}
            disabled={!bridge || modelSelectionBlocked}
            text={draftText}
            onTextChange={setDraftText}
            promptPresets={promptPresets}
            promptHistory={promptHistory}
            onSelectPreset={applyPromptText}
            onSelectHistory={applyPromptText}
            onRemoveHistory={handleRemoveHistory}
            attachments={pendingAttachments}
            onAddFiles={handleAddFiles}
            onRemoveAttachment={handleRemoveAttachment}
          />
        </div>
      </div>
    </>
  );
}
