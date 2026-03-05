import React from 'react';
import { Sparkles, Send } from 'lucide-react';
import { createAIDemoSchema } from '../ai/demo-schema';
import type { EditorAIBridge } from '../ai/editor-ai-bridge';

export interface AIPanelProps {
  bridge?: EditorAIBridge;
}

export function AIPanel({ bridge }: AIPanelProps) {
  const [statusText, setStatusText] = React.useState<string>('等待指令');
  const [selectedNodeLabel, setSelectedNodeLabel] = React.useState<string>('未选中');

  React.useEffect(() => {
    if (!bridge) {
      return undefined;
    }
    return bridge.subscribe((snapshot) => {
      setSelectedNodeLabel(snapshot.selectedNodeId ?? '未选中');
    });
  }, [bridge]);

  const handleGenerateDemo = async () => {
    if (!bridge) {
      setStatusText('Bridge 未连接');
      return;
    }
    setStatusText('正在生成...');
    const result = await bridge.execute('schema.replace', {
      schema: createAIDemoSchema(),
    });
    if (result.success) {
      setStatusText('已应用 AI 演示页面');
      return;
    }
    setStatusText(`生成失败：${result.error ?? '未知错误'}`);
  };

  return (
    <div className="w-full h-full bg-bg-panel border-l border-border-ide flex flex-col shrink-0 overflow-hidden">
      <div className="h-9 px-4 border-b border-border-ide flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2 text-text-primary">
          <Sparkles size={14} className="text-blue-500" />
          <span className="text-[11px] font-bold uppercase tracking-wider">AI Assistant</span>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
        <div className="bg-bg-canvas border border-border-ide rounded-md p-3 flex flex-col gap-2">
          <span className="text-[11px] text-text-secondary">当前选中节点：{selectedNodeLabel}</span>
          <span className="text-[11px] text-text-secondary">状态：{statusText}</span>
          <button
            type="button"
            onClick={handleGenerateDemo}
            className="self-start mt-1 h-7 px-3 rounded border border-border-ide bg-bg-activity-bar text-[12px] text-text-primary hover:border-blue-500 transition-colors"
          >
            生成演示页面
          </button>
        </div>

        {/* Mock Messages */}
        <div className="flex flex-col gap-1">
          <span className="text-[10px] text-text-secondary font-semibold">Shenbi AI</span>
          <div className="bg-bg-canvas border border-border-ide text-text-primary text-[12px] p-2 rounded-md rounded-tl-none leading-relaxed">
            你好！我是 Shenbi 智能开发助手。您可以让我帮您生成布局、绑定数据、调整样式，甚至是完整生成一个应用页面。有什么我可以帮您的吗？
          </div>
        </div>
        
        <div className="flex flex-col gap-1 items-end mt-2">
          <span className="text-[10px] text-text-secondary font-semibold">You</span>
          <div className="bg-blue-600 text-white text-[12px] p-2 rounded-md rounded-tr-none leading-relaxed shadow-sm">
            帮我设计一个高级的数据看板页面，带有深色模式支持和响应式。
          </div>
        </div>
      </div>

      <div className="p-3 border-t border-border-ide shrink-0 bg-bg-panel">
        <div className="relative flex items-center">
          <input 
            type="text" 
            placeholder="Ask AI anything... (Cmd+K)" 
            className="w-full bg-bg-canvas border border-border-ide text-text-primary text-[12px] rounded-md pl-3 pr-8 py-2 focus:outline-none focus:border-blue-500 transition-colors shadow-inner"
          />
          <button className="absolute right-2 p-1 text-text-secondary hover:text-blue-500 transition-colors">
            <Send size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
