import React from 'react';
export interface ToolbarMenuItem {
  id: string;
  label: string;
  commandId: string;
  section?: 'primary' | 'secondary';
  target?: 'toolbar-start' | 'toolbar-end';
  group?: string;
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

  const renderMenuGroup = (items: readonly ToolbarMenuItem[]) => {
    const groups = new Map<string, ToolbarMenuItem[]>();
    for (const item of items) {
      const groupKey = item.group ?? '__default__';
      const groupItems = groups.get(groupKey) ?? [];
      groupItems.push(item);
      groups.set(groupKey, groupItems);
    }

    return [...groups.entries()].map(([group, groupItems], index) => (
      <React.Fragment key={group}>
        {index > 0 ? <div role="separator" className="mx-1 h-4 w-[1px] bg-border-ide" /> : null}
        {groupItems.map((menu) => (
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
      </React.Fragment>
    ));
  };

  const primaryMenus = menus.filter((item) => item.section !== 'secondary');
  const secondaryMenus = menus.filter((item) => item.section === 'secondary');

  return (
    <div className="flex items-center gap-1">
      {renderMenuGroup(primaryMenus)}
      {secondaryMenus.length > 0 ? (
        <div className="ml-1 flex items-center gap-1 border-l border-border-ide pl-2">
          {renderMenuGroup(secondaryMenus)}
        </div>
      ) : null}
    </div>
  );
}
