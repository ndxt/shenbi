export function isObject(value: unknown): value is Record<string, any> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function toExpressionDataSources<T extends { data: any }>(
  dsState: Record<string, T>,
): Record<string, any> {
  const output: Record<string, any> = {};
  for (const [name, item] of Object.entries(dsState)) {
    output[name] = item?.data;
  }
  return output;
}

export function getStatePathValue(state: Record<string, any>, path: string): any {
  const normalized = path.startsWith('state.') ? path.slice('state.'.length) : path;
  const parts = normalized.split('.').filter(Boolean);
  let cursor: any = state;
  for (const part of parts) {
    if (cursor == null) {
      return undefined;
    }
    cursor = cursor[part];
  }
  return cursor;
}

export function appendQuery(url: string, params: Record<string, any>): string {
  const entries = Object.entries(params ?? {}).filter(([, val]) => val != null);
  if (entries.length === 0) {
    return url;
  }

  const search = new URLSearchParams();
  for (const [key, value] of entries) {
    search.set(key, String(value));
  }

  const hasQuery = url.includes('?');
  return `${url}${hasQuery ? '&' : '?'}${search.toString()}`;
}

export function clearTimerRecord(
  timers: Record<string | number, ReturnType<typeof setTimeout>>,
): void {
  for (const timer of Object.values(timers)) {
    clearTimeout(timer);
  }
  for (const key of Object.keys(timers)) {
    delete timers[key];
  }
}

export function safeJsonSnapshot(value: unknown): string {
  const seen = new WeakSet<object>();

  try {
    return JSON.stringify(value, (_key, current) => {
      if (current && typeof current === 'object') {
        if (seen.has(current)) {
          return '__CIRCULAR__';
        }
        seen.add(current);
      }
      if (typeof current === 'function') {
        return '__FUNCTION__';
      }
      return current;
    });
  } catch (_error) {
    return String(value);
  }
}
