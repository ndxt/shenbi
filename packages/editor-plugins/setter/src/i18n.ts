import { registerTranslationNamespace } from '@shenbi/i18n';
import zhCN from './locales/zh-CN.json';
import enUS from './locales/en-US.json';

export const setterLocaleResources = {
  'zh-CN': zhCN,
  'en-US': enUS,
} as const;

registerTranslationNamespace('pluginSetter', setterLocaleResources);
