import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import type { LocaleNamespaceResources, SupportedLocale } from './types';
import { DEFAULT_LOCALE } from './types';
import zhCNCommon from '../locales/zh-CN/common.json';
import zhCNEditorUi from '../locales/zh-CN/editorUi.json';
import zhCNPreview from '../locales/zh-CN/preview.json';
import enUSCommon from '../locales/en-US/common.json';
import enUSEditorUi from '../locales/en-US/editorUi.json';
import enUSPreview from '../locales/en-US/preview.json';

export const resources = {
  'zh-CN': {
    common: zhCNCommon,
    editorUi: zhCNEditorUi,
    preview: zhCNPreview,
  },
  'en-US': {
    common: enUSCommon,
    editorUi: enUSEditorUi,
    preview: enUSPreview,
  },
};

function getStoredLocale(): SupportedLocale | null {
  if (typeof window === 'undefined') {
    return null;
  }
  const stored = localStorage.getItem('shenbi-locale');
  if (stored === 'zh-CN' || stored === 'en-US') {
    return stored;
  }
  return null;
}

function detectBrowserLocale(): SupportedLocale {
  if (typeof window === 'undefined') {
    return DEFAULT_LOCALE;
  }
  return navigator.language.startsWith('zh') ? 'zh-CN' : 'en-US';
}

function getInitialLocale(): SupportedLocale {
  return getStoredLocale() ?? detectBrowserLocale();
}

i18n.use(initReactI18next).init({
  resources,
  lng: getInitialLocale(),
  fallbackLng: DEFAULT_LOCALE,
  defaultNS: 'common',
  interpolation: {
    escapeValue: false,
  },
  react: {
    useSuspense: false,
  },
});

export default i18n;

export function registerTranslationNamespace(
  namespace: string,
  localeResources: LocaleNamespaceResources,
): void {
  for (const locale of Object.keys(localeResources) as SupportedLocale[]) {
    const bundle = localeResources[locale];
    if (!bundle) {
      continue;
    }
    i18n.addResourceBundle(locale, namespace, bundle, true, true);
  }
}

export function setStoredLocale(locale: SupportedLocale): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem('shenbi-locale', locale);
  }
}

export async function changeLanguage(locale: SupportedLocale): Promise<void> {
  await i18n.changeLanguage(locale);
  setStoredLocale(locale);
}
