import React from 'react';

export interface CommandPaletteItem {
  id: string;
  title: string;
  category?: string;
  description?: string;
  aliases?: string[];
  keywords?: string[];
  shortcut: string | undefined;
  source: 'host' | 'plugin';
  disabled?: boolean;
}

function normalizeSearchValue(value: string): string {
  return value.trim().toLowerCase();
}

function getCommandMatchScore(command: CommandPaletteItem, normalizedQuery: string): number {
  if (!normalizedQuery) {
    return 1;
  }

  const exactTerms = [
    command.title,
    ...(command.aliases ?? []),
    ...(command.keywords ?? []),
  ].map(normalizeSearchValue);
  if (exactTerms.includes(normalizedQuery)) {
    return 120;
  }

  const prefixTerms = [
    command.title,
    ...(command.aliases ?? []),
    ...(command.keywords ?? []),
  ].map(normalizeSearchValue);
  if (prefixTerms.some((value) => value.startsWith(normalizedQuery))) {
    return 90;
  }

  const secondaryTerms = [
    command.category,
    command.description,
    command.id,
    ...(command.aliases ?? []),
    ...(command.keywords ?? []),
  ].filter((value): value is string => Boolean(value)).map(normalizeSearchValue);
  if (secondaryTerms.some((value) => value.includes(normalizedQuery))) {
    return 60;
  }

  const titleWords = normalizeSearchValue(command.title).split(/\s+/);
  if (titleWords.some((word) => word.startsWith(normalizedQuery))) {
    return 75;
  }

  return 0;
}

interface CommandPaletteProps {
  commands: CommandPaletteItem[];
  recentCommandIds?: string[];
  open: boolean;
  onClose: () => void;
  onRunCommand: (commandId: string) => void;
}

export function CommandPalette({
  commands,
  recentCommandIds = [],
  open,
  onClose,
  onRunCommand,
}: CommandPaletteProps) {
  const [query, setQuery] = React.useState('');
  const [selectedCommandId, setSelectedCommandId] = React.useState<string | undefined>(undefined);
  const listRef = React.useRef<HTMLDivElement | null>(null);
  const itemRefs = React.useRef(new Map<string, HTMLButtonElement | null>());

  React.useEffect(() => {
    if (!open) {
      setQuery('');
      setSelectedCommandId(undefined);
    }
  }, [open]);

  const filteredCommands = React.useMemo(() => {
    const normalizedQuery = normalizeSearchValue(query);
    if (!normalizedQuery) {
      return commands;
    }
    const recentIndexMap = new Map(recentCommandIds.map((commandId, index) => [commandId, index]));
    return commands
      .map((command) => ({
        command,
        score: getCommandMatchScore(command, normalizedQuery),
      }))
      .filter((entry) => entry.score > 0)
      .sort((left, right) => {
        if (right.score !== left.score) {
          return right.score - left.score;
        }
        const leftRecentIndex = recentIndexMap.get(left.command.id) ?? Number.MAX_SAFE_INTEGER;
        const rightRecentIndex = recentIndexMap.get(right.command.id) ?? Number.MAX_SAFE_INTEGER;
        if (leftRecentIndex !== rightRecentIndex) {
          return leftRecentIndex - rightRecentIndex;
        }
        return left.command.title.localeCompare(right.command.title);
      })
      .map((entry) => entry.command);
  }, [commands, query, recentCommandIds]);
  const groupedCommands = React.useMemo(() => {
    if (query.trim().length === 0 && recentCommandIds.length > 0) {
      const commandById = new Map(filteredCommands.map((command) => [command.id, command]));
      const recentCommands = recentCommandIds
        .map((commandId) => commandById.get(commandId))
        .filter((command): command is CommandPaletteItem => Boolean(command));
      const recentCommandIdsSet = new Set(recentCommands.map((command) => command.id));
      const groups: Array<[string, CommandPaletteItem[]]> = [];

      if (recentCommands.length > 0) {
        groups.push(['Recent', recentCommands]);
      }

      const remainingGroups = new Map<string, CommandPaletteItem[]>();
      for (const command of filteredCommands) {
        if (recentCommandIdsSet.has(command.id)) {
          continue;
        }
        const key = command.category ?? 'Other';
        const items = remainingGroups.get(key) ?? [];
        items.push(command);
        remainingGroups.set(key, items);
      }

      return [...groups, ...remainingGroups.entries()];
    }

    const groups = new Map<string, CommandPaletteItem[]>();
    for (const command of filteredCommands) {
      const key = command.category ?? 'Other';
      const items = groups.get(key) ?? [];
      items.push(command);
      groups.set(key, items);
    }
    return [...groups.entries()];
  }, [filteredCommands, query, recentCommandIds]);
  const orderedCommands = React.useMemo(
    () => groupedCommands.flatMap(([, items]) => items),
    [groupedCommands],
  );
  const selectableCommandIds = React.useMemo(
    () => orderedCommands.filter((command) => !command.disabled).map((command) => command.id),
    [orderedCommands],
  );

  React.useEffect(() => {
    if (selectableCommandIds.length === 0) {
      setSelectedCommandId(undefined);
      return;
    }
    if (!selectedCommandId || !selectableCommandIds.includes(selectedCommandId)) {
      setSelectedCommandId(selectableCommandIds[0]);
    }
  }, [selectableCommandIds, selectedCommandId]);

  React.useEffect(() => {
    if (!selectedCommandId) {
      return;
    }
    const selectedElement = itemRefs.current.get(selectedCommandId);
    selectedElement?.scrollIntoView?.({ block: 'nearest' });
  }, [selectedCommandId]);

  const moveSelection = (direction: 1 | -1) => {
    if (selectableCommandIds.length === 0) {
      return;
    }
    const currentIndex = selectedCommandId ? selectableCommandIds.indexOf(selectedCommandId) : -1;
    const nextIndex = currentIndex === -1
      ? 0
      : (currentIndex + direction + selectableCommandIds.length) % selectableCommandIds.length;
    setSelectedCommandId(selectableCommandIds[nextIndex]);
  };

  const runSelectedCommand = () => {
    if (!selectedCommandId) {
      return;
    }
    onRunCommand(selectedCommandId);
    onClose();
  };

  if (!open) {
    return null;
  }

  return (
    <div
      className="absolute inset-0 z-40 flex items-start justify-center bg-black/20 pt-24"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command Palette"
        className="w-[560px] overflow-hidden rounded border border-border-ide bg-bg-panel shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="border-b border-border-ide px-3 py-2">
          <input
            autoFocus
            data-shenbi-command-palette-input="true"
            aria-label="Command Palette Search"
            aria-controls="command-palette-listbox"
            aria-activedescendant={selectedCommandId ? `command-palette-option-${selectedCommandId}` : undefined}
            className="w-full bg-transparent text-sm text-text-primary outline-none"
            placeholder="Type a command"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape' || event.key === 'Tab') {
                event.preventDefault();
                onClose();
                return;
              }
              if (event.key === 'ArrowDown') {
                event.preventDefault();
                moveSelection(1);
                return;
              }
              if (event.key === 'ArrowUp') {
                event.preventDefault();
                moveSelection(-1);
                return;
              }
              if (event.key === 'Enter') {
                event.preventDefault();
                runSelectedCommand();
              }
            }}
          />
        </div>
        <div
          id="command-palette-listbox"
          ref={listRef}
          role="listbox"
          aria-label="Command Palette Results"
          className="max-h-[360px] overflow-auto py-1"
        >
          {orderedCommands.length === 0 ? (
            <div className="px-3 py-4 text-sm text-text-secondary">No commands found.</div>
          ) : (
            groupedCommands.map(([category, items]) => (
              <div key={category} className="py-1">
                <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-text-secondary">
                  {category}
                </div>
                {items.map((command) => (
                  <button
                    key={command.id}
                    id={`command-palette-option-${command.id}`}
                    ref={(element) => {
                      itemRefs.current.set(command.id, element);
                    }}
                    type="button"
                    role="option"
                    disabled={command.disabled}
                    aria-selected={selectedCommandId === command.id}
                    className={`flex w-full items-center justify-between px-3 py-2 text-left ${
                      command.disabled
                        ? 'cursor-not-allowed opacity-50'
                        : selectedCommandId === command.id
                          ? 'bg-bg-activity-bar'
                          : 'hover:bg-bg-activity-bar'
                    }`}
                    onMouseEnter={() => {
                      if (!command.disabled) {
                        setSelectedCommandId(command.id);
                      }
                    }}
                    onClick={() => {
                      if (command.disabled) {
                        return;
                      }
                      setSelectedCommandId(command.id);
                      onRunCommand(command.id);
                      onClose();
                    }}
                  >
                    <div className="min-w-0">
                      <div className="text-sm text-text-primary">{command.title}</div>
                      <div className="text-[11px] text-text-secondary">
                        {command.description ?? `${command.id} · ${command.source}`}
                      </div>
                    </div>
                    <div className="text-[11px] text-text-secondary">
                      {command.shortcut ?? ''}
                    </div>
                  </button>
                ))}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
