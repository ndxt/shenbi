import React from 'react';

export interface CommandPaletteItem {
  id: string;
  title: string;
  shortcut: string | undefined;
  source: 'host' | 'plugin';
}

interface CommandPaletteProps {
  commands: CommandPaletteItem[];
  open: boolean;
  onClose: () => void;
  onRunCommand: (commandId: string) => void;
}

export function CommandPalette({
  commands,
  open,
  onClose,
  onRunCommand,
}: CommandPaletteProps) {
  const [query, setQuery] = React.useState('');

  React.useEffect(() => {
    if (!open) {
      setQuery('');
    }
  }, [open]);

  const filteredCommands = React.useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      return commands;
    }
    return commands.filter((command) => (
      command.title.toLowerCase().includes(normalizedQuery)
      || command.id.toLowerCase().includes(normalizedQuery)
    ));
  }, [commands, query]);

  if (!open) {
    return null;
  }

  return (
    <div
      className="absolute inset-0 z-40 flex items-start justify-center bg-black/20 pt-24"
      onClick={onClose}
    >
      <div
        className="w-[560px] overflow-hidden rounded border border-border-ide bg-bg-panel shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="border-b border-border-ide px-3 py-2">
          <input
            autoFocus
            aria-label="Command Palette Search"
            className="w-full bg-transparent text-sm text-text-primary outline-none"
            placeholder="Type a command"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <div className="max-h-[360px] overflow-auto py-1">
          {filteredCommands.length === 0 ? (
            <div className="px-3 py-4 text-sm text-text-secondary">No commands found.</div>
          ) : (
            filteredCommands.map((command) => (
              <button
                key={command.id}
                type="button"
                className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-bg-activity-bar"
                onClick={() => {
                  onRunCommand(command.id);
                  onClose();
                }}
              >
                <div className="min-w-0">
                  <div className="text-sm text-text-primary">{command.title}</div>
                  <div className="text-[11px] text-text-secondary">
                    {command.id} · {command.source}
                  </div>
                </div>
                <div className="text-[11px] text-text-secondary">
                  {command.shortcut ?? ''}
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
