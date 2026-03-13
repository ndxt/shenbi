import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import type { LocaleNamespaceResources, SupportedLocale } from './types';
import { DEFAULT_LOCALE, detectBrowserLocale } from './types';
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

i18n.use(initReactI18next).init({
  resources,
  lng: detectBrowserLocale(),
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

export async function changeLanguage(locale: SupportedLocale): Promise<void> {
  await i18n.changeLanguage(locale);
}
