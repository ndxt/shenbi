import React, { useEffect, useRef } from 'react';
import { Sparkles, Loader2, Info } from 'lucide-react';
import type { EditorAIBridge } from '../ai/editor-ai-bridge';
import { useModels } from '../hooks/useModels';
import { useChatSession } from '../hooks/useChatSession';
import { useAgentRun } from '../hooks/useAgentRun';
import { ChatMessageList } from './ChatMessageList';
import { ChatInput } from './ChatInput';
import { ModelSelector } from './ModelSelector';

export interface AIPanelProps {
  bridge?: EditorAIBridge;
  defaultPlannerModel?: string;
  defaultBlockModel?: string;
}

export function AIPanel({ bridge, defaultPlannerModel, defaultBlockModel }: AIPanelProps) {
  const {
    plannerModels,
    plannerModel,
    setPlannerModel,
    blockModels,
    blockModel,
    setBlockModel,
  } = useModels(defaultPlannerModel, defaultBlockModel);

  const {
    messages,
    addMessage,
    updateMessage,
    conversationId,
    setConversationId,
    lastMetadata,
    setLastMetadata,
  } = useChatSession();

  const {
    isRunning,
    progressText,
    currentPlan,
    runAgent,
    cancelRun,
  } = useAgentRun(bridge);

  const [selectedNodeLabel, setSelectedNodeLabel] = React.useState<string>('未选中');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!bridge) return;
    return bridge.subscribe((snapshot) => {
      setSelectedNodeLabel(snapshot.selectedNodeId ?? '未选中');
    });
  }, [bridge]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, progressText]);

  const handleSend = (text: string) => {
    const currentConvId = conversationId ?? `conv-${Date.now()}`;
    if (!conversationId) setConversationId(currentConvId);

    addMessage({ role: 'user', content: text });

    void runAgent(
      text,
      plannerModel,
      blockModel,
      currentConvId,
      () => addMessage({ role: 'assistant', content: '' }),
      (id, chunk) => updateMessage(id, (prev) => prev + chunk),
      (metadata) => {
        if (metadata) setLastMetadata(metadata);
      },
      (err) => addMessage({ role: 'assistant', content: `[Error]: ${err}` })
    );
  };

  return (
    <div className="w-full h-full bg-bg-panel border-l border-border-ide flex flex-col shrink-0 overflow-hidden">
      <div className="h-9 px-4 border-b border-border-ide flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2 text-text-primary">
          <Sparkles size={14} className="text-blue-500" />
          <span className="text-[11px] font-bold uppercase tracking-wider">AI Assistant</span>
        </div>
      </div>

      <div className="flex-none p-3 border-b border-border-ide flex gap-4 bg-bg-canvas">
        <ModelSelector label="Planner" models={plannerModels} value={plannerModel} onChange={setPlannerModel} disabled={isRunning} />
        <ModelSelector label="Block" models={blockModels} value={blockModel} onChange={setBlockModel} disabled={isRunning} />
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
        {messages.length === 0 && (
          <div className="text-[12px] text-text-secondary text-center py-10 opacity-60">
            你好！我是 Shenbi 智能开发助手。可以帮您生成布局、绑定数据、调整样式。<br />有什么我可以帮您的吗？
          </div>
        )}

        <ChatMessageList messages={messages} />

        {isRunning && (
          <div className="bg-bg-activity-bar border border-border-ide rounded-md p-3 flex flex-col gap-2 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 left-0 h-1 bg-blue-500 animate-pulse w-full"></div>
            <div className="flex items-center gap-2 text-[11px] text-text-primary">
              <Loader2 size={12} className="animate-spin text-blue-500" />
              <span className="font-semibold text-blue-500">正在生成</span>
              <span className="opacity-70 ml-auto truncate flex-1 text-right">{progressText}</span>
            </div>
            {currentPlan && (
              <div className="mt-2 border-t border-border-ide pt-2">
                <div className="text-[10px] text-text-secondary font-bold uppercase mb-1 flex items-center gap-1">
                  <Info size={10} /> {currentPlan.title || '架构计划'}
                </div>
                <ul className="flex flex-col gap-1 pl-2">
                  {currentPlan.blocks.map((b, i) => (
                    <li key={i} className="text-[11px] text-text-primary flex gap-2">
                      <span className="text-blue-400 font-mono">[{b.type}]</span>
                      <span className="opacity-80 truncate">{b.description}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {messages.length > 0 && !isRunning && lastMetadata && (
          <div className="text-[10px] text-text-secondary flex justify-center gap-4 opacity-50">
            <span>耗时: {lastMetadata.durationMs}ms</span>
            <span>Tokens: {lastMetadata.tokensUsed}</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className="p-3 border-t border-border-ide shrink-0 bg-bg-canvas flex flex-col gap-2">
        <div className="text-[10px] text-text-secondary flex justify-between">
          <span>选中: <span className="text-blue-400">{selectedNodeLabel}</span></span>
          {!bridge && <span className="text-red-400">Bridge 未连接</span>}
        </div>
        <ChatInput
          onSend={handleSend}
          onCancel={cancelRun}
          isRunning={isRunning}
          disabled={!bridge}
        />
      </div>
    </div>
  );
}
