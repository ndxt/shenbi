import { useCallback } from 'react';

export interface HostCommandPolicyInterceptor {
  matches: (commandId: string, payload?: unknown) => boolean;
  handle: (commandId: string, payload?: unknown) => unknown | Promise<unknown>;
}

export interface UseHostCommandPolicyOptions {
  executeBaseCommand: (commandId: string, payload?: unknown) => unknown | Promise<unknown>;
  commandHandlers?: Record<string, (payload?: unknown) => unknown | Promise<unknown>>;
  interceptors?: readonly HostCommandPolicyInterceptor[];
}

export interface UseHostCommandPolicyResult {
  executeCommand: (commandId: string, payload?: unknown) => Promise<unknown>;
}

export function useHostCommandPolicy({
  executeBaseCommand,
  commandHandlers,
  interceptors = [],
}: UseHostCommandPolicyOptions): UseHostCommandPolicyResult {
  const executeCommand = useCallback(async (commandId: string, payload?: unknown) => {
    for (const interceptor of interceptors) {
      if (interceptor.matches(commandId, payload)) {
        return await interceptor.handle(commandId, payload);
      }
    }

    const commandHandler = commandHandlers?.[commandId];
    if (commandHandler) {
      return await commandHandler(payload);
    }

    return await executeBaseCommand(commandId, payload);
  }, [commandHandlers, executeBaseCommand, interceptors]);

  return {
    executeCommand,
  };
}
