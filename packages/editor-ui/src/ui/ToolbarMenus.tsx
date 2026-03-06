import React from 'react';
export interface ToolbarMenuItem {
  id: string;
  label: string;
  commandId: string;
  section?: 'primary' | 'secondary';
  disabled?: boolean;
}

interface ToolbarMenusProps {
  menus: readonly ToolbarMenuItem[];
  onRunCommand: (commandId: string) => void;
}

export function ToolbarMenus({ menus, onRunCommand }: ToolbarMenusProps) {
  if (menus.length === 0) {
    return null;
  }

  const primaryMenus = menus.filter((item) => item.section !== 'secondary');
  const secondaryMenus = menus.filter((item) => item.section === 'secondary');

  return (
    <div className="flex items-center gap-1">
      {primaryMenus.map((menu) => (
        <button
          key={menu.id}
          type="button"
          disabled={menu.disabled}
          className={`rounded px-2 py-1 text-[12px] transition-colors ${
            menu.disabled
              ? 'cursor-not-allowed text-text-secondary/50'
              : 'text-text-secondary hover:bg-bg-activity-bar hover:text-text-primary'
          }`}
          onClick={() => {
            if (menu.disabled) {
              return;
            }
            onRunCommand(menu.commandId);
          }}
        >
          {menu.label}
        </button>
      ))}
      {secondaryMenus.length > 0 ? (
        <div className="ml-1 flex items-center gap-1 border-l border-border-ide pl-2">
          {secondaryMenus.map((menu) => (
            <button
              key={menu.id}
              type="button"
              disabled={menu.disabled}
              className={`rounded px-2 py-1 text-[12px] transition-colors ${
                menu.disabled
                  ? 'cursor-not-allowed text-text-secondary/50'
                  : 'text-text-secondary hover:bg-bg-activity-bar hover:text-text-primary'
              }`}
              onClick={() => {
                if (menu.disabled) {
                  return;
                }
                onRunCommand(menu.commandId);
              }}
            >
              {menu.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
