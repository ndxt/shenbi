export type { LocaleConfig, LocaleNamespaceResources, SupportedLocale } from './types';
export {
  DEFAULT_LOCALE,
  LOCALE_CONFIGS,
  SUPPORTED_LOCALES,
  detectBrowserLocale,
  isSupportedLocale,
} from './types';
export {
  default as i18n,
  changeLanguage,
  registerTranslationNamespace,
  resources,
} from './instance';
export { useAntdLocale, useCurrentLocale } from './hooks';
export { Trans, useTranslation } from 'react-i18next';
