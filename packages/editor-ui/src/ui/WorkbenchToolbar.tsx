import React from 'react';
import { 
  Play, 
  Code2, 
  ChevronRight,
  Share2
} from 'lucide-react';
import { ToolbarMenus } from './ToolbarMenus';
import type { ToolbarMenuItem } from './ToolbarMenus';

interface WorkbenchToolbarProps {
  extra?: React.ReactNode;
  menus?: ToolbarMenuItem[];
  onRunMenuCommand?: (commandId: string) => void;
  breadcrumbItems?: { id: string; label: string }[];
  onBreadcrumbSelect?: ((nodeId: string) => void) | undefined;
  onBreadcrumbHover?: ((nodeId: string | null) => void) | undefined;
}

export function WorkbenchToolbar({ extra, menus, onRunMenuCommand, breadcrumbItems = [], onBreadcrumbSelect, onBreadcrumbHover }: WorkbenchToolbarProps) {
  const startMenus = React.useMemo(
    () => menus?.filter((menu) => menu.target === 'toolbar-start') ?? [],
    [menus],
  );
  const endMenus = React.useMemo(
    () => menus?.filter((menu) => menu.target !== 'toolbar-start') ?? [],
    [menus],
  );

  return (
    <div className="h-9 bg-bg-sidebar border-b border-border-ide flex items-center justify-between px-2 shrink-0">
      <div className="flex items-center gap-2">
        {startMenus.length > 0 && onRunMenuCommand ? (
          <div className="flex items-center gap-1">
            <ToolbarMenus menus={startMenus} onRunCommand={onRunMenuCommand} />
          </div>
        ) : null}
      </div>

      {breadcrumbItems.length > 0 && (
        <div className="flex items-center text-[11px] text-text-secondary gap-1 overflow-hidden max-w-[40%]">
          {breadcrumbItems.map((item, index) => (
            <React.Fragment key={item.id}>
              {index > 0 && <ChevronRight size={12} />}
              <button
                type="button"
                className={`truncate hover:text-text-primary transition-colors cursor-pointer bg-transparent border-0 p-0 ${
                  index === breadcrumbItems.length - 1 ? 'text-text-primary' : ''
                }`}
                onClick={() => onBreadcrumbSelect?.(item.id)}
                onMouseEnter={() => onBreadcrumbHover?.(item.id)}
                onMouseLeave={() => onBreadcrumbHover?.(null)}
              >
                {item.label}
              </button>
            </React.Fragment>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2">
        {endMenus.length > 0 && onRunMenuCommand ? <ToolbarMenus menus={endMenus} onRunCommand={onRunMenuCommand} /> : null}
        {extra ? <div>{extra}</div> : null}
        <button className="flex items-center gap-1.5 px-2 py-1 hover:bg-bg-activity-bar rounded text-emerald-500 transition-colors">
          <Play size={14} fill="currentColor" />
          <span className="text-[12px] font-medium text-text-primary">Run</span>
        </button>
        <ToolbarButton icon={Code2} />
        <ToolbarButton icon={Share2} />
      </div>
    </div>
  );
}

function ToolbarButton({ icon: Icon, active = false }: { icon: any, active?: boolean }) {
  return (
    <div className={`
      p-1.5 rounded cursor-pointer transition-colors
      ${active ? 'bg-bg-activity-bar text-blue-500' : 'text-text-secondary hover:bg-bg-activity-bar hover:text-text-primary'}
    `}>
      <Icon size={16} />
    </div>
  );
}
