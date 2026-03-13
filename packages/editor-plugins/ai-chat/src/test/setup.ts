import '@testing-library/jest-dom/vitest';
import { i18n, changeLanguage, registerTranslationNamespace } from '@shenbi/i18n';
import aiChatLocaleResources from '../locales/zh-CN.json';

// Register AI Chat locale resources
registerTranslationNamespace('pluginAiChat', {
  'zh-CN': aiChatLocaleResources,
  'en-US': aiChatLocaleResources, // Use same for en-US in tests
});

// Set locale to zh-CN for tests to match existing expectations
void changeLanguage('zh-CN');
