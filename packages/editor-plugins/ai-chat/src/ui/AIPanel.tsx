import React, { useEffect, useRef } from 'react';
import { Sparkles, Loader2, BrainCircuit, Trash2, CheckCircle2 } from 'lucide-react';
import {
  executePluginCommand,
  type PluginContext,
} from '@shenbi/editor-plugin-api';
import type { EditorAIBridge } from '../ai/editor-ai-bridge';
import { useModels } from '../hooks/useModels';
import { useChatSession } from '../hooks/useChatSession';
import { useAgentRun } from '../hooks/useAgentRun';
import { ChatMessageList } from './ChatMessageList';
import { ChatInput } from './ChatInput';
import { ModelSelector } from './ModelSelector';

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

const PROMPT_PRESETS = [
  {
    label: '工作台总览',
    value: '生成一个复杂工作台首页，包含筛选区、指标卡、趋势图、表格列表、右侧详情抽屉和顶部快捷操作，重点覆盖卡片、表格、Tabs、Drawer、Form、按钮和响应式布局组合。',
  },
  {
    label: '主从详情',
    value: '生成一个主从详情页面：左侧树或列表，右侧 Tabs 详情区，支持查询、状态标签、操作按钮、表单编辑弹窗和底部时间线，覆盖 Tree、Tabs、Descriptions、Modal、Form、Tag 组合。',
  },
  {
    label: '表单编排',
    value: '生成一个复杂表单编排页面，包含基础信息、分组区域、Form.List 动态增删、联动校验、提交按钮区和结果预览卡片，覆盖 Form、Input、Select、DatePicker、Form.List、Card、Alert 组合。',
  },
  {
    label: '列表加抽屉',
    value: '生成一个列表页，包含查询表单、批量操作栏、数据表格、行内操作、详情抽屉和分页，覆盖 Query Form、Table、Drawer、Space、Button、Tag 常见覆盖场景。',
  },
  {
    label: '多区块门户',
    value: '生成一个多区块门户页面，包含顶部欢迎区、左右分栏卡片、中部九宫格快捷入口、下方图文混排信息区和浮动操作按钮，覆盖 Grid、Card、Typography、List、Flex、FloatButton 组合。',
  },
] as const;

function extractDebugFilePath(message: string): string | undefined {
  const matched = message.match(/(?:Trace|Debug) file:\s*([^\r\n]+)/i);
  return matched?.[1]?.trim();
}

function getDebugFileLabel(path: string): 'Trace File' | 'Debug File' {
  return /(?:^|[\\/])(?:\.ai-debug[\\/])?traces(?:[\\/]|$)/i.test(path)
    ? 'Trace File'
    : 'Debug File';
}

export function AIPanel({
  bridge,
  pluginContext,
  defaultPlannerModel,
  defaultBlockModel,
}: AIPanelProps) {
  const persistence = pluginContext?.persistence;
  const [thinkingEnabled, setThinkingEnabled] = React.useState(false);
  const [blockConcurrency, setBlockConcurrency] = React.useState(3);
  const [draftText, setDraftText] = React.useState('');
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
    conversationId,
    setConversationId,
    lastMetadata,
    setLastMetadata,
    lastDebugFile,
    setLastDebugFile,
    resetSession,
  } = useChatSession(persistence);

  const {
    isRunning,
    progressText,
    currentPlan,
    blockStatuses,
    modifyPlan,
    modifyStatuses,
    modifyOpMetrics,
    elapsedMs,
    blockTokens,
    blockInputTokens,
    blockOutputTokens,
    blockDurationMs,
    plannerMetrics,
    lastRunResult,
    setLastRunResult,
    runAgent,
    cancelRun,
  } = useAgentRun(bridge);

  // Unified compact metrics badge: 'Xs In300 Out2000'
  const MetricsBadge = ({ durationMs, inputTokens, outputTokens }: { durationMs: number | undefined; inputTokens: number | undefined; outputTokens: number | undefined }) => {
    const parts: string[] = [];
    if (durationMs !== undefined) parts.push(`${(durationMs / 1000).toFixed(1)}s`);
    if (inputTokens !== undefined) parts.push(`In${inputTokens}`);
    if (outputTokens !== undefined) parts.push(`Out${outputTokens}`);
    if (parts.length === 0) return null;
    return <span className="text-text-secondary font-mono tabular-nums shrink-0" style={{ fontSize: '9px' }}>{parts.join(' ')}</span>;
  };

  // Shared op row used in both running and completed cards
  const OpRow = ({
    label,
    isPending,
    isDone,
    metrics,
    isError,
  }: {
    label: string;
    isPending?: boolean;
    isDone?: boolean;
    metrics?: { durationMs: number | undefined; inputTokens: number | undefined; outputTokens: number | undefined };
    isError?: boolean;
  }) => (
    <li
      className={`flex items-center gap-1.5 py-1.5 rounded px-1.5 ${
        isPending ? 'animate-pulse bg-blue-500/5' : ''
      }`}
      style={{ fontSize: '11px' }}
    >
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

  const [selectedNodeLabel, setSelectedNodeLabel] = React.useState<string>('未选中');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const modelsReady = plannerModels.length > 0 && blockModels.length > 0;
  const modelSelectionBlocked = isLoadingModels || Boolean(modelsError) || !modelsReady;

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
      setSelectedNodeLabel(snapshot.selectedNodeId ?? '未选中');
    });
  }, [bridge]);

  useEffect(() => {
    const target = messagesEndRef.current;
    if (!target || typeof target.scrollIntoView !== 'function') {
      return;
    }
    target.scrollIntoView({ behavior: 'smooth' });
  }, [messages, progressText]);

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
    resetSession();
    setDraftText('');
    void executePluginCommand(pluginContext ?? {}, 'workspace.resetDocument');
  }, [isRunning, pluginContext, resetSession]);

  const handleSend = (text: string) => {
    if (modelSelectionBlocked) {
      addMessage({ role: 'assistant', content: `[Error]: ${modelsError ?? '模型列表尚未加载完成'}` });
      return;
    }

    const currentConvId = conversationId ?? `conv-${Date.now()}`;
    if (!conversationId) setConversationId(currentConvId);

    addMessage({ role: 'user', content: text });
    rememberPrompt(text);
    setDraftText('');
    setLastDebugFile(undefined);

    void runAgent(
      text,
      plannerModel,
      blockModel,
      thinkingEnabled,
      currentConvId,
      () => addMessage({ role: 'assistant', content: '' }),
      (id, chunk) => updateMessage(id, (prev) => prev + chunk),
      (metadata) => {
        if (metadata) {
          setLastMetadata(metadata);
          setLastDebugFile(metadata.debugFile);
        }
      },
      (err) => {
        setLastMetadata(undefined);
        setLastDebugFile(extractDebugFilePath(err));
        addMessage({ role: 'assistant', content: `[Error]: ${err}` });
      },
      blockConcurrency,
    );
  };

  return (
      <div className="w-full h-full bg-bg-panel border-l border-border-ide flex flex-col shrink-0 overflow-hidden">
      <div className="h-9 px-4 border-b border-border-ide flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2 text-text-primary">
          <Sparkles size={14} className="text-blue-500" />
          <span className="font-bold uppercase tracking-wider" style={{ fontSize: '11px' }}>AI Assistant</span>
        </div>
        <button
          type="button"
          className="rounded p-1.5 text-text-secondary transition-colors hover:bg-bg-canvas hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-50"
          onClick={handleClear}
          disabled={isRunning}
          aria-label="清空"
          title="清空当前会话和页面"
        >
          <span className="flex items-center gap-1">
            <Trash2 size={13} />
            <span>清空</span>
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
        <label className="flex items-center gap-1.5 cursor-pointer select-none shrink-0" title="思考模式">
          <span className="text-text-secondary uppercase tracking-wider" style={{ fontSize: '10px' }}>思考</span>
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
        <span className="text-text-secondary uppercase tracking-wider shrink-0" style={{ fontSize: '10px' }}>并发</span>
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
          title={`并发 block 数: ${blockConcurrency}`}
        />
        <span className="text-text-primary font-mono shrink-0 w-4 text-center" style={{ fontSize: '11px' }}>{blockConcurrency}</span>
      </div>

      {isLoadingModels && (
        <div className="px-4 py-2 text-text-secondary border-b border-border-ide bg-bg-panel" style={{ fontSize: '11px' }}>
          正在加载模型列表...
        </div>
      )}

      {modelsError && (
        <div className="px-4 py-2 text-red-400 border-b border-border-ide bg-bg-panel" style={{ fontSize: '11px' }}>
          模型列表加载失败: {modelsError}
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-6">
        {messages.length === 0 && (
          <div className="text-text-secondary text-center py-10 opacity-60" style={{ fontSize: '12px' }}>
            你好！我是 Shenbi 智能开发助手。<br />可以帮您生成布局、绑定数据、调整样式。<br />有什么我可以帮您的吗？
          </div>
        )}

        <ChatMessageList messages={messages} />

        {isRunning && (
          <div className="bg-bg-canvas border border-border-ide rounded-md p-3 flex flex-col gap-2 shadow-sm relative overflow-hidden mt-2">
            <div className="absolute top-0 left-0 h-[2px] bg-gradient-to-r from-blue-500 via-indigo-400 to-blue-500 animate-[shimmer_1.5s_ease-in-out_infinite] w-full" />
            <div className="flex items-center gap-2 text-text-primary" style={{ fontSize: '11px' }}>
              <Loader2 size={12} className="animate-spin text-blue-500 shrink-0" />
              <span className="font-semibold text-blue-500 shrink-0">正在生成</span>
              <span className="opacity-70 ml-1 truncate flex-1">{progressText}</span>
              <span className="text-text-secondary font-mono shrink-0 tabular-nums" style={{ fontSize: '10px' }}>
                {Math.floor(elapsedMs / 1000)}s
              </span>
            </div>
            {/* Planner row (create-page) */}
            {plannerMetrics && currentPlan && (
              <div className="border-t border-border-ide pt-1 flex items-center gap-1.5 px-1" style={{ fontSize: '10px' }}>
                <span className="text-text-secondary opacity-70 truncate flex-1">Planner</span>
                <MetricsBadge durationMs={plannerMetrics.durationMs} inputTokens={plannerMetrics.inputTokens} outputTokens={plannerMetrics.outputTokens} />
                <CheckCircle2 size={10} className="text-emerald-400 shrink-0" />
              </div>
            )}
            {/* Block list (create-page) */}
            {currentPlan && (
              <div className="border-t border-border-ide pt-1">
                <ul className="flex flex-col gap-1.5 m-0 p-0">
                  {currentPlan.blocks.map((b) => (
                    <OpRow
                      key={b.id}
                      label={b.description}
                      isPending={blockStatuses[b.id] === 'generating'}
                      isDone={blockStatuses[b.id] === 'done'}
                      metrics={{ durationMs: blockDurationMs[b.id], inputTokens: blockInputTokens[b.id], outputTokens: blockOutputTokens[b.id] }}
                    />
                  ))}
                </ul>
              </div>
            )}
            {/* Modify op list */}
            {modifyPlan && (
              <div className="border-t border-border-ide pt-1">
                <ul className="flex flex-col gap-1.5 m-0 p-0">
                  {Array.from({ length: modifyPlan.operationCount }, (_, i) => (
                    <OpRow
                      key={i}
                      label={modifyPlan.operationLabels[i] ?? `操作 ${i + 1}`}
                      isPending={modifyStatuses[i] === 'generating'}
                      isDone={modifyStatuses[i] === 'done'}
                      {...(modifyOpMetrics[i] ? { metrics: { durationMs: modifyOpMetrics[i].durationMs, inputTokens: modifyOpMetrics[i].inputTokens, outputTokens: modifyOpMetrics[i].outputTokens } } : {})}
                    />
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {lastRunResult && (
          <div className="bg-bg-canvas border border-border-ide rounded-md p-3 flex flex-col gap-2 shadow-sm mt-2" style={{ fontSize: '11px' }}>
            {/* Header */}
            <div className="flex items-center gap-2 text-text-primary">
              <CheckCircle2 size={12} className="text-emerald-400 shrink-0" />
              <span className="font-semibold text-emerald-400 shrink-0">{lastRunResult.modifyPlan ? '修改完成' : '生成完成'}</span>
              <span className="opacity-70 ml-1 truncate flex-1 leading-none">{lastRunResult.statusLabel}</span>
              <button
                className="text-text-secondary hover:text-text-primary opacity-50 hover:opacity-100 transition-opacity ml-1 shrink-0"
                onClick={() => setLastRunResult(null)}
                title="关闭"
              >
                ×
              </button>
            </div>
            {/* Planner row (create-page) */}
            {lastRunResult.plannerMetrics && lastRunResult.plan && (
              <div className="border-t border-border-ide pt-1 flex items-center gap-1.5 px-1">
                <span className="text-text-secondary opacity-70 truncate flex-1">Planner</span>
                <MetricsBadge durationMs={lastRunResult.plannerMetrics.durationMs} inputTokens={lastRunResult.plannerMetrics.inputTokens} outputTokens={lastRunResult.plannerMetrics.outputTokens} />
                <CheckCircle2 size={10} className="text-emerald-400 shrink-0" />
              </div>
            )}
            {/* Block list (create-page) */}
            {lastRunResult.plan && (
              <div className="border-t border-border-ide pt-1.5">
                <ul className="flex flex-col gap-1.5 m-0 p-0">
                  {lastRunResult.plan.blocks.map((b) => (
                    <OpRow
                      key={b.id}
                      label={b.description}
                      isDone={lastRunResult.blockStatuses[b.id] === 'done'}
                      metrics={{ durationMs: lastRunResult.blockDurationMs[b.id], inputTokens: lastRunResult.blockInputTokens[b.id], outputTokens: lastRunResult.blockOutputTokens[b.id] }}
                    />
                  ))}
                </ul>
              </div>
            )}
            {/* Modify op list */}
            {lastRunResult.modifyPlan && (
              <div className="border-t border-border-ide pt-1.5">
                <ul className="flex flex-col gap-1.5 m-0 p-0">
                  {Array.from({ length: lastRunResult.modifyPlan.operationCount }, (_, i) => (
                    <OpRow
                      key={i}
                      label={lastRunResult.modifyPlan?.operationLabels[i] ?? `操作 ${i + 1}`}
                      isDone={lastRunResult.modifyStatuses[i] === 'done'}
                      isError={lastRunResult.modifyStatuses[i] !== 'done'}
                      {...(lastRunResult.modifyOpMetrics[i] ? { metrics: { durationMs: lastRunResult.modifyOpMetrics[i].durationMs, inputTokens: lastRunResult.modifyOpMetrics[i].inputTokens, outputTokens: lastRunResult.modifyOpMetrics[i].outputTokens } } : {})}
                    />
                  ))}
                </ul>
              </div>
            )}
            {/* Summary totals */}
            {(() => {
              const totalInput = [
                lastRunResult.plannerMetrics?.inputTokens ?? 0,
                ...Object.values(lastRunResult.blockInputTokens),
                ...Object.values(lastRunResult.modifyOpMetrics).map((m) => m.inputTokens ?? 0),
              ].reduce((a, b) => a + b, 0);
              const totalOutput = [
                lastRunResult.plannerMetrics?.outputTokens ?? 0,
                ...Object.values(lastRunResult.blockOutputTokens),
                ...Object.values(lastRunResult.modifyOpMetrics).map((m) => m.outputTokens ?? 0),
              ].reduce((a, b) => a + b, 0);
              const hasTokenInfo = totalInput > 0 || totalOutput > 0;
              return (
                <div className="border-t border-border-ide pt-1 flex items-center gap-2 px-1" style={{ fontSize: '10px' }}>
                  <span className="text-text-secondary opacity-70 flex-1">合计</span>
                  <span className="text-text-secondary font-mono tabular-nums">{(lastRunResult.elapsedMs / 1000).toFixed(1)}s</span>
                  {hasTokenInfo && (
                    <span className="text-text-secondary font-mono tabular-nums">In{totalInput} Out{totalOutput}</span>
                  )}
                  {typeof lastRunResult.tokensUsed === 'number' && !hasTokenInfo && (
                    <span className="text-text-secondary font-mono tabular-nums">{lastRunResult.tokensUsed}t</span>
                  )}
                </div>
              );
            })()}
          </div>
        )}

        {messages.length > 0 && !isRunning && (lastMetadata || lastDebugFile) && (
          <div className="text-text-secondary flex flex-col items-center gap-1 opacity-50 mb-2" style={{ fontSize: '10px' }}>
            {lastMetadata && (typeof lastMetadata.durationMs === 'number' || typeof lastMetadata.tokensUsed === 'number') && (
              <div className="flex justify-center gap-4">
                {typeof lastMetadata.durationMs === 'number' && (
                  <span>耗时: {lastMetadata.durationMs}ms</span>
                )}
                {typeof lastMetadata.tokensUsed === 'number' && (
                  <span>Tokens: {lastMetadata.tokensUsed}</span>
                )}
              </div>
            )}
            {lastDebugFile && (
              <span className="font-mono break-all text-center">{getDebugFileLabel(lastDebugFile)}: {lastDebugFile}</span>
            )}
            {lastMetadata?.memoryDebugFile && (
              <span className="font-mono break-all text-center">Memory Dump: {lastMetadata.memoryDebugFile}</span>
            )}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className="border-t border-border-ide shrink-0 bg-bg-panel flex flex-col gap-2" style={{ padding: '8px' }}>
        <div className="text-text-secondary flex justify-between px-1" style={{ fontSize: '11px' }}>
          <span>选中: <span className="text-text-primary">{selectedNodeLabel}</span></span>
          {!bridge && <span className="text-red-400">Bridge 未连接</span>}
        </div>
        <ChatInput
          onSend={handleSend}
          onCancel={cancelRun}
          isRunning={isRunning}
          disabled={!bridge || modelSelectionBlocked}
          text={draftText}
          onTextChange={setDraftText}
          promptPresets={[...PROMPT_PRESETS]}
          promptHistory={promptHistory}
          onSelectPreset={applyPromptText}
          onSelectHistory={applyPromptText}
          onRemoveHistory={handleRemoveHistory}
        />
      </div>
    </div>
  );
}
