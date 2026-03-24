import React from 'react';
import { useTranslation } from '@shenbi/i18n';
import { Play, Network, Clock, Database, ChevronRight, Activity, Code, Settings } from 'lucide-react';

export interface ActionPanelProps {
  actions?: any[];
  onChange?: (actions: any[]) => void;
}

export function ActionPanel({ actions, onChange }: ActionPanelProps) {
  const { t } = useTranslation('pluginSetter');

  return (
    <div className="flex flex-col h-full bg-bg-panel text-text-primary overflow-hidden">
      
      {/* Top Action Toolbar */}
      <div className="p-2 border-b border-border-ide/50 flex items-center justify-between shrink-0">
        <span className="text-[11px] font-semibold text-text-secondary uppercase opacity-80 pl-1">{t('panel.actions')}</span>
        <button className="bg-primary/10 hover:bg-primary/20 text-primary hover:text-primary px-2 py-1.5 rounded-md text-[11px] font-medium flex items-center gap-1.5 transition-colors">
          <Play size={13} strokeWidth={2} />
          <span>{t('actions.newFlow')}</span>
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col md:flex-row min-h-0 min-w-0">
        
        {/* Left Side: Action List */}
        <div className="w-full md:w-[220px] lg:w-[260px] border-r border-border-ide/50 flex flex-col shrink-0 min-w-0">
          <div className="p-2 border-b border-border-ide/40 flex bg-bg-sidebar">
            <input 
              type="text" 
              placeholder={t('actions.searchPlaceholder')} 
              className="w-full bg-text-primary/[0.03] dark:bg-text-primary/[0.05] border border-transparent rounded-md px-2.5 py-1.5 text-[12px] outline-none focus:bg-transparent focus:border-primary/50 focus:ring-1 focus:ring-primary/20 text-text-primary transition-colors"
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
          <div className="p-3 border-b border-border-ide/50 bg-bg-sidebar flex items-center justify-between shrink-0">
             <div className="flex items-center gap-2 min-w-0">
               <Network size={16} strokeWidth={1.5} className="text-primary shrink-0" />
               <h3 className="text-[13px] font-medium truncate">getUserList</h3>
             </div>
             <div className="flex gap-2 shrink-0">
               <span className="text-[10px] bg-green-500/10 text-green-500 dark:text-green-400 px-2 py-0.5 rounded-md border border-green-500/20 font-medium">{t('actions.fetchApi')}</span>
             </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 flex justify-center flex-col min-w-0 relative">
             
             {/* Simple Diagram Placeholder (Non-draggable for phase 2) */}
             <div className="w-full max-w-lg mx-auto relative min-h-[300px]">
                
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-0.5 h-full bg-border-ide z-0" />

                <div className="relative z-10 flex flex-col items-center gap-8">
                  {/* Start Node */}
                  <div className="w-12 h-12 rounded-full border border-primary/50 bg-primary/10 flex items-center justify-center shadow-lg shadow-primary/10">
                    <Play size={16} strokeWidth={1.5} className="text-primary ml-1" />
                  </div>

                  {/* Config Node */}
                  <div className="w-full max-w-[280px] bg-bg-sidebar/80 backdrop-blur-md border border-border-ide/50 rounded-lg p-3 shadow-xl hover:border-primary/50 transition-colors cursor-pointer group">
                    <div className="flex items-center justify-between mb-2">
                       <span className="text-[11px] font-semibold text-text-secondary uppercase opacity-80">{t('actions.prepareRequestParams')}</span>
                       <Settings size={14} strokeWidth={1.5} className="text-text-secondary/50 group-hover:text-primary transition-colors" />
                    </div>
                    <div className="text-[12px] bg-text-primary/[0.02] p-2.5 rounded-md font-mono text-yellow-600 dark:text-yellow-400 border border-border-ide/30">
                      {'{ page: 1, limit: 10, ...state.filters }'}
                    </div>
                  </div>

                  {/* Fetch Node */}
                  <div className="w-full max-w-[280px] bg-bg-sidebar/80 backdrop-blur-md border border-green-500/30 ring-1 ring-green-500/10 rounded-lg p-3 shadow-xl cursor-pointer">
                    <div className="flex items-center gap-2.5 mb-2.5">
                       <Database size={15} strokeWidth={1.5} className="text-green-500" />
                       <span className="text-[13px] font-medium">GET /api/v1/users</span>
                    </div>
                    <div className="text-[11px] text-text-secondary/80 flex justify-between">
                       <span>Timeout: 5000ms</span>
                       <span>Retries: 1</span>
                    </div>
                  </div>

                  {/* End/Success Node */}
                  <div className="w-full max-w-[280px] bg-bg-sidebar/80 backdrop-blur-md border border-border-ide/50 rounded-lg p-3 shadow-xl cursor-pointer flex items-center gap-3">
                     <div className="w-7 h-7 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center shrink-0">
                       <Activity size={14} strokeWidth={1.5} className="text-green-500" />
                     </div>
                     <span className="text-[12px] font-medium text-text-primary/90">{t('actions.assignResultTo', { target: 'state.userList' })}</span>
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
      case 'api': return <Database size={14} strokeWidth={1.5} className="text-green-500" />;
      case 'state': return <Activity size={14} strokeWidth={1.5} className="text-primary" />;
      case 'code': return <Code size={14} strokeWidth={1.5} className="text-yellow-500" />;
      case 'flow': return <Network size={14} strokeWidth={1.5} className="text-purple-500" />;
      default: return <Clock size={14} strokeWidth={1.5} className="text-text-secondary" />;
    }
  };

  return (
    <div className={`
      flex items-center px-2 py-2 rounded-md cursor-pointer group min-w-0 transition-colors
      ${isActive ? 'bg-primary/10 text-primary' : 'hover:bg-text-primary/5 text-text-primary/90'}
    `}>
      <div className="mr-2 shrink-0">
        {getIcon()}
      </div>
      <span className={`text-[12px] flex-1 truncate ${isActive ? 'font-medium' : ''}`}>{name}</span>
      <ChevronRight size={14} strokeWidth={1.5} className={`shrink-0 ${isActive ? 'text-primary' : 'text-transparent group-hover:text-text-secondary/50'}`} />
    </div>
  );
}
