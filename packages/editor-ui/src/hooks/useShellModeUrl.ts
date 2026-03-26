import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react';

export type ShellMode = 'scenarios' | 'shell';

export interface ShellModeUrlOptions {
  queryKey?: string;
  shellValue?: string;
  globalFlagKey?: string;
}

const DEFAULT_QUERY_KEY = 'mode';
const DEFAULT_SHELL_VALUE = 'shell';
const DEFAULT_GLOBAL_FLAG_KEY = '__SHENBI_SHELL_MODE__';

function resolveOptions(options?: ShellModeUrlOptions): Required<ShellModeUrlOptions> {
  return {
    queryKey: options?.queryKey ?? DEFAULT_QUERY_KEY,
    shellValue: options?.shellValue ?? DEFAULT_SHELL_VALUE,
    globalFlagKey: options?.globalFlagKey ?? DEFAULT_GLOBAL_FLAG_KEY,
  };
}

export function getInitialShellMode(options?: ShellModeUrlOptions): ShellMode {
  return 'shell';
}

export function syncShellModeToUrl(mode: ShellMode, options?: ShellModeUrlOptions): void {
  // No-op: Shell mode is now the only mode, no need to touch the URL.
}

export function useShellModeUrl(
  options?: ShellModeUrlOptions,
): [ShellMode, Dispatch<SetStateAction<ShellMode>>] {
  const resolved = useMemo(() => resolveOptions(options), [
    options?.globalFlagKey,
    options?.queryKey,
    options?.shellValue,
  ]);

  const [mode, setMode] = useState<ShellMode>(() => getInitialShellMode(resolved));

  useEffect(() => {
    syncShellModeToUrl(mode, resolved);
  }, [mode, resolved]);

  return [mode, setMode];
}
