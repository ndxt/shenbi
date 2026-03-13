export type { LocaleConfig, LocaleNamespaceResources, SupportedLocale } from './types';
export { DEFAULT_LOCALE, LOCALE_CONFIGS, SUPPORTED_LOCALES } from './types';
export {
  default as i18n,
  changeLanguage,
  registerTranslationNamespace,
  resources,
  setStoredLocale,
} from './instance';
export { useAntdLocale, useCurrentLocale } from './hooks';
export { Trans, useTranslation } from 'react-i18next';
