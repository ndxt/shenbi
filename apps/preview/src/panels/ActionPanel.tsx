import React from 'react';
import { Play, Network, Clock, Database, ChevronRight, Activity, Code, Settings } from 'lucide-react';

export interface ActionPanelProps {
  actions?: any[];
  onChange?: (actions: any[]) => void;
}

export function ActionPanel({ actions, onChange }: ActionPanelProps) {
  return (
    <div className="flex flex-col h-full bg-bg-panel text-text-primary overflow-hidden">
      
      {/* Top Action Toolbar */}
      <div className="p-2 border-b border-border-ide flex items-center justify-between shrink-0">
        <span className="text-[11px] font-bold text-text-secondary uppercase">交互编排 (Actions)</span>
        <button className="bg-blue-600 hover:bg-blue-500 text-white px-2 py-1 rounded text-[11px] flex items-center gap-1 transition-colors">
          <Play size={12} />
          <span>新建流</span>
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col md:flex-row min-h-0 min-w-0">
        
        {/* Left Side: Action List */}
        <div className="w-full md:w-[220px] lg:w-[260px] border-r border-border-ide flex flex-col shrink-0 min-w-0">
          <div className="p-2 border-b border-border-ide flex bg-bg-sidebar">
            <input 
              type="text" 
              placeholder="搜索 Action..." 
              className="w-full bg-bg-canvas border border-border-ide rounded-sm px-2 py-1 text-[11px] outline-none focus:border-blue-500 text-text-primary"
            />
          </div>
          <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1">
            <ActionListItem name="getUserList" type="api" isActive />
            <ActionListItem name="submitForm" type="api" />
            <ActionListItem name="updateLocalState" type="state" />
            <ActionListItem name="validateForm" type="code" />
            <ActionListItem name="initData" type="flow" />
          </div>
        </div>

        {/* Right Side: Action Canvas Placeholder */}
        <div className="flex-1 flex flex-col bg-bg-canvas min-w-0">
          <div className="p-3 border-b border-border-ide bg-bg-sidebar flex items-center justify-between shrink-0">
             <div className="flex items-center gap-2 min-w-0">
               <Network size={16} className="text-blue-500 shrink-0" />
               <h3 className="text-[13px] font-semibold truncate">getUserList</h3>
             </div>
             <div className="flex gap-2 shrink-0">
               <span className="text-[10px] bg-green-500/20 text-green-500 px-2 py-0.5 rounded border border-green-500/30">Fetch API</span>
             </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 flex justify-center flex-col min-w-0 relative">
             
             {/* Simple Diagram Placeholder (Non-draggable for phase 2) */}
             <div className="w-full max-w-lg mx-auto relative min-h-[300px]">
                
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-0.5 h-full bg-border-ide z-0" />

                <div className="relative z-10 flex flex-col items-center gap-8">
                  {/* Start Node */}
                  <div className="w-12 h-12 rounded-full border-2 border-blue-500 bg-bg-panel flex items-center justify-center">
                    <Play size={16} className="text-blue-500 ml-1" />
                  </div>

                  {/* Config Node */}
                  <div className="w-full max-w-[280px] bg-bg-panel border border-border-ide rounded-md p-3 shadow-lg hover:border-blue-500 transition-colors cursor-pointer group">
                    <div className="flex items-center justify-between mb-2">
                       <span className="text-[11px] font-bold text-text-secondary uppercase">准备请求参数</span>
                       <Settings size={12} className="text-text-secondary group-hover:text-blue-500 transition-colors" />
                    </div>
                    <div className="text-[12px] bg-bg-canvas p-2 rounded font-mono text-yellow-400 border border-border-ide">
                      {'{ page: 1, limit: 10, ...state.filters }'}
                    </div>
                  </div>

                  {/* Fetch Node */}
                  <div className="w-full max-w-[280px] bg-bg-panel border-2 border-green-500/50 rounded-md p-3 shadow-lg cursor-pointer">
                    <div className="flex items-center gap-2 mb-2">
                       <Database size={14} className="text-green-500" />
                       <span className="text-[12px] font-semibold">GET /api/v1/users</span>
                    </div>
                    <div className="text-[10px] text-text-secondary flex justify-between">
                       <span>Timeout: 5000ms</span>
                       <span>Retries: 1</span>
                    </div>
                  </div>

                  {/* End/Success Node */}
                  <div className="w-full max-w-[280px] bg-bg-panel border border-border-ide rounded-md p-3 shadow-lg cursor-pointer flex items-center gap-2">
                     <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center shrink-0">
                       <Activity size={12} className="text-green-500" />
                     </div>
                     <span className="text-[12px]">将结果赋值给 state.userList</span>
                  </div>

                </div>
             </div>
             
          </div>

        </div>
      </div>
    </div>
  );
}

// --- List Item Helper ---

function ActionListItem({ name, type, isActive = false }: { name: string, type: 'api' | 'state' | 'code' | 'flow', isActive?: boolean }) {
  const getIcon = () => {
    switch (type) {
      case 'api': return <Database size={14} className="text-green-500" />;
      case 'state': return <Activity size={14} className="text-blue-500" />;
      case 'code': return <Code size={14} className="text-yellow-500" />;
      case 'flow': return <Network size={14} className="text-purple-500" />;
      default: return <Clock size={14} className="text-text-secondary" />;
    }
  };

  return (
    <div className={`
      flex items-center p-2 rounded cursor-pointer group min-w-0
      ${isActive ? 'bg-blue-500/20 text-blue-500 border border-blue-500/30' : 'hover:bg-bg-activity-bar border border-transparent'}
    `}>
      <div className="mr-2 shrink-0">
        {getIcon()}
      </div>
      <span className={`text-[12px] flex-1 truncate ${isActive ? 'font-semibold' : ''}`}>{name}</span>
      <ChevronRight size={14} className={`shrink-0 ${isActive ? 'text-blue-500' : 'text-transparent group-hover:text-text-secondary'}`} />
    </div>
  );
}
