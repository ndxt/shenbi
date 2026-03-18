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
  const resolved = resolveOptions(options);
  if (typeof window === 'undefined') {
    return 'scenarios';
  }

  const search = new URLSearchParams(window.location.search);
  const modeValue = search.get(resolved.queryKey);
  if (modeValue === resolved.shellValue) {
    return 'shell';
  }
  if (modeValue === 'scenarios') {
    return 'scenarios';
  }

  const globalFlag = (window as unknown as Record<string, unknown>)[resolved.globalFlagKey];
  if (globalFlag === true) {
    return 'shell';
  }

  return 'shell';
}

export function syncShellModeToUrl(mode: ShellMode, options?: ShellModeUrlOptions): void {
  const resolved = resolveOptions(options);
  if (typeof window === 'undefined') {
    return;
  }

  const url = new URL(window.location.href);
  if (mode === 'shell') {
    url.searchParams.set(resolved.queryKey, resolved.shellValue);
  } else {
    url.searchParams.set(resolved.queryKey, 'scenarios');
  }
  window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
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
