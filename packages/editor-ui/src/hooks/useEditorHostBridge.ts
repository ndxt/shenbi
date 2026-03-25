import { useCallback } from 'react';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export interface CommandExecutor {
  execute: (commandId: string, payload?: unknown) => unknown | Promise<unknown>;
}

export interface UseEditorHostBridgeOptions {
  mode: 'shell' | 'scenarios';
  shellCommands: CommandExecutor;
  scenarioCommands: (commandId: string, payload?: unknown) => Promise<unknown>;
  activeFileId: string | undefined;
  schemaName: string | undefined;
  promptFileName?: (defaultName: string) => string | null | Promise<string | null>;
}

export interface UseEditorHostBridgeResult {
  executeBaseCommand: (commandId: string, payload?: unknown) => unknown | Promise<unknown>;
  executePluginCommand: (commandId: string, payload?: unknown) => unknown | Promise<unknown>;
}

export function useEditorHostBridge(options: UseEditorHostBridgeOptions): UseEditorHostBridgeResult {
  const executeBaseCommand = useCallback((commandId: string, payload?: unknown) => {
    if (options.mode === 'shell') {
      return options.shellCommands.execute(commandId, payload);
    }
    return options.scenarioCommands(commandId, payload);
  }, [options.mode, options.scenarioCommands, options.shellCommands]);

  const executePluginCommand = useCallback(async (commandId: string, payload?: unknown) => {
    const defaultName = options.schemaName?.trim() || 'new-page';

    if (commandId === 'file.saveAs') {
      const explicitName = isRecord(payload) && typeof payload.name === 'string' && payload.name.trim().length > 0
        ? payload.name.trim()
        : await options.promptFileName?.(defaultName);
      if (!explicitName) {
        return undefined;
      }
      return executeBaseCommand(commandId, { name: explicitName });
    }

    if (commandId === 'file.saveSchema' && !options.activeFileId && (!isRecord(payload) || payload.fileId === undefined)) {
      const explicitName = await options.promptFileName?.(defaultName);
      if (!explicitName) {
        return undefined;
      }
      return executeBaseCommand('file.saveAs', { name: explicitName });
    }

    if (commandId === 'file.saveSchema' && options.mode === 'shell' && options.activeFileId) {
      return options.shellCommands.execute('tab.save', payload);
    }

    return executeBaseCommand(commandId, payload);
  }, [executeBaseCommand, options.activeFileId, options.mode, options.promptFileName, options.schemaName, options.shellCommands]);

  return {
    executeBaseCommand,
    executePluginCommand,
  };
}
