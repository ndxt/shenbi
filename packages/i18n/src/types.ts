export type SupportedLocale = 'zh-CN' | 'en-US';

export type LocaleNamespaceResources = Partial<Record<SupportedLocale, Record<string, unknown>>>;

export const DEFAULT_LOCALE: SupportedLocale = 'zh-CN';
export const SUPPORTED_LOCALES: SupportedLocale[] = ['zh-CN', 'en-US'];

export function isSupportedLocale(value: unknown): value is SupportedLocale {
  return value === 'zh-CN' || value === 'en-US';
}

export function detectBrowserLocale(browserLocale?: string): SupportedLocale {
  const resolvedLocale = browserLocale
    ?? (typeof navigator !== 'undefined' ? navigator.language : undefined);
  return resolvedLocale?.startsWith('zh') ? 'zh-CN' : 'en-US';
}

export type LocaleConfig = {
  code: SupportedLocale;
  name: string;
  nativeName: string;
};

export const LOCALE_CONFIGS: LocaleConfig[] = [
  { code: 'zh-CN', name: 'Chinese Simplified', nativeName: '简体中文' },
  { code: 'en-US', name: 'English (US)', nativeName: 'English' },
];
