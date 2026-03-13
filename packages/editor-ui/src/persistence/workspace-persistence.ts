import type { PluginPersistenceService } from '@shenbi/editor-plugin-api';
import { isSupportedLocale, type SupportedLocale } from '@shenbi/i18n';

export interface WorkspacePersistenceAdapter {
  getJSON: <T>(workspaceId: string, namespace: string, key: string) => Promise<T | undefined>;
  setJSON: <T>(workspaceId: string, namespace: string, key: string, value: T) => Promise<void>;
  remove: (workspaceId: string, namespace: string, key: string) => Promise<void>;
}

const STORAGE_PREFIX = 'shenbi:workspace';
export const WORKSPACE_LAYOUT_NAMESPACE = 'layout';
export const WORKSPACE_PREFERENCES_NAMESPACE = 'preferences';
export const WORKSPACE_WORKBENCH_KEY = 'workbench';

const LEGACY_KEY_MAP: Record<string, string[]> = {
  [`${WORKSPACE_LAYOUT_NAMESPACE}:${WORKSPACE_WORKBENCH_KEY}`]: ['shenbi:app-shell:layout'],
  [`${WORKSPACE_PREFERENCES_NAMESPACE}:${WORKSPACE_WORKBENCH_KEY}`]: ['shenbi-locale'],
  'ai-chat:model-selection': ['shenbi:ai-chat:model-selection'],
  'ai-chat:session': ['shenbi:ai-chat:session'],
  'ai-chat:ui': ['shenbi:ai-chat:ui'],
  'ai-chat:prompt-history': ['shenbi:ai-chat:prompt-history'],
  'preview-debug:active-scenario': ['shenbi:preview:active-scenario'],
};

function getScopedStorageKey(workspaceId: string, namespace: string, key: string): string {
  return `${STORAGE_PREFIX}:${workspaceId}:${namespace}:${key}`;
}

function getLegacyStorageKeys(namespace: string, key: string): string[] {
  return LEGACY_KEY_MAP[`${namespace}:${key}`] ?? [];
}

function parseStoredJSON<T>(rawValue: string | null): T | undefined {
  if (!rawValue) {
    return undefined;
  }

  try {
    return JSON.parse(rawValue) as T;
  } catch {
    return undefined;
  }
}

function parseLegacyLocalePreference(rawValue: string | null): { locale: SupportedLocale } | undefined {
  if (!rawValue) {
    return undefined;
  }

  if (isSupportedLocale(rawValue)) {
    return { locale: rawValue };
  }

  const parsedValue = parseStoredJSON<unknown>(rawValue);
  if (isSupportedLocale(parsedValue)) {
    return { locale: parsedValue };
  }

  return undefined;
}

function parseLegacyValue<T>(namespace: string, key: string, legacyKey: string, rawValue: string | null): T | undefined {
  if (
    namespace === WORKSPACE_PREFERENCES_NAMESPACE
    && key === WORKSPACE_WORKBENCH_KEY
    && legacyKey === 'shenbi-locale'
  ) {
    return parseLegacyLocalePreference(rawValue) as T | undefined;
  }

  return parseStoredJSON<T>(rawValue);
}

export class LocalWorkspacePersistenceAdapter implements WorkspacePersistenceAdapter {
  private readonly storage: Storage | undefined;

  constructor(storage?: Storage) {
    this.storage = storage ?? (typeof window !== 'undefined' ? window.localStorage : undefined);
  }

  async getJSON<T>(workspaceId: string, namespace: string, key: string): Promise<T | undefined> {
    if (!this.storage) {
      return undefined;
    }

    const scopedKey = getScopedStorageKey(workspaceId, namespace, key);
    const storedValue = parseStoredJSON<T>(this.storage.getItem(scopedKey));
    if (storedValue !== undefined) {
      return storedValue;
    }

    for (const legacyKey of getLegacyStorageKeys(namespace, key)) {
      const legacyValue = parseLegacyValue<T>(namespace, key, legacyKey, this.storage.getItem(legacyKey));
      if (legacyValue === undefined) {
        continue;
      }

      await this.setJSON(workspaceId, namespace, key, legacyValue);
      this.storage.removeItem(legacyKey);
      return legacyValue;
    }

    return undefined;
  }

  async setJSON<T>(workspaceId: string, namespace: string, key: string, value: T): Promise<void> {
    if (!this.storage) {
      return;
    }

    try {
      this.storage.setItem(getScopedStorageKey(workspaceId, namespace, key), JSON.stringify(value));
    } catch {
      // Ignore storage failures and keep the workspace usable.
    }
  }

  async remove(workspaceId: string, namespace: string, key: string): Promise<void> {
    if (!this.storage) {
      return;
    }

    this.storage.removeItem(getScopedStorageKey(workspaceId, namespace, key));
    for (const legacyKey of getLegacyStorageKeys(namespace, key)) {
      this.storage.removeItem(legacyKey);
    }
  }
}

export function createWorkspacePersistenceService(
  workspaceId: string,
  adapter: WorkspacePersistenceAdapter,
): PluginPersistenceService {
  return {
    getJSON: (namespace, key) => adapter.getJSON(workspaceId, namespace, key),
    setJSON: (namespace, key, value) => adapter.setJSON(workspaceId, namespace, key, value),
    remove: (namespace, key) => adapter.remove(workspaceId, namespace, key),
  };
}
