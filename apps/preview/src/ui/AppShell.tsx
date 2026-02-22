import React from 'react';
import { ActivityBar } from './ActivityBar';
import { Sidebar } from './Sidebar';
import { WorkbenchToolbar } from './WorkbenchToolbar';
import { EditorTabs } from './EditorTabs';
import { Inspector } from './Inspector';
import { Console } from './Console';
import { StatusBar } from './StatusBar';
import '../styles/preview-ide.css';

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="h-screen w-screen flex flex-col bg-zinc-950 text-zinc-100 overflow-hidden">
      {/* Main Container */}
      <div className="flex-1 flex overflow-hidden">
        <ActivityBar />
        <Sidebar />
        
        <div className="flex-1 flex flex-col overflow-hidden">
          <EditorTabs />
          <WorkbenchToolbar />
          
          <div className="flex-1 flex overflow-hidden">
            {/* Editor/Canvas Area Container */}
            <div className="flex-1 flex flex-col overflow-hidden relative bg-zinc-950">
              <main className="flex-1 overflow-auto p-12 flex justify-center items-start scrollbar-hide relative">
                {/* Grid Background - Isolated to this main area */}
                <div className="absolute inset-0 pointer-events-none canvas-grid opacity-100" />
                {/* The Stage / Viewport */}
                <div className="relative z-10 stage-viewport min-h-[600px] w-full max-w-[1200px] rounded-sm overflow-hidden border border-zinc-800">
                  <div className="bg-zinc-50 min-h-full">
                    {children}
                  </div>
                  
                  {/* Viewport Meta Info (Figma Style) */}
                  <div className="absolute -top-6 left-0 text-[10px] text-zinc-500 font-mono flex gap-3">
                    <span>1200 x 800</span>
                    <span>100%</span>
                  </div>
                </div>
              </main>
              
              <Console />
            </div>

            <Inspector />
          </div>
        </div>
      </div>

      <StatusBar />
    </div>
  );
}
