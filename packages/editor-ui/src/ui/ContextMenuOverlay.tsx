import React from 'react';
export interface ContextMenuItem {
  id: string;
  label: string;
  commandId: string;
  disabled?: boolean;
}

interface ContextMenuOverlayProps {
  items: readonly ContextMenuItem[];
  open: boolean;
  position: { x: number; y: number };
  onClose: () => void;
  onRunCommand: (commandId: string) => void;
}

export function ContextMenuOverlay({
  items,
  open,
  position,
  onClose,
  onRunCommand,
}: ContextMenuOverlayProps) {
  React.useEffect(() => {
    if (!open) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose, open]);

  if (!open || items.length === 0) {
    return null;
  }

  return (
    <div
      className="absolute inset-0 z-50"
      onClick={onClose}
      onContextMenu={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <div
        role="menu"
        aria-label="Canvas Context Menu"
        className="absolute min-w-[180px] overflow-hidden rounded border border-border-ide bg-bg-panel py-1 shadow-2xl"
        style={{ left: position.x, top: position.y }}
        onClick={(event) => event.stopPropagation()}
      >
        {items.map((item) => (
          <button
            key={item.id}
            role="menuitem"
            type="button"
            disabled={item.disabled}
            className={`flex w-full items-center px-3 py-2 text-left text-[12px] ${
              item.disabled
                ? 'cursor-not-allowed text-text-secondary/50'
                : 'text-text-primary hover:bg-bg-activity-bar'
            }`}
            onClick={() => {
              if (item.disabled) {
                return;
              }
              onRunCommand(item.commandId);
              onClose();
            }}
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}
