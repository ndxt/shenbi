import { useEffect, useState } from 'react';
import type { Locale } from 'antd/es/locale';
import i18n from './instance';
import type { SupportedLocale } from './types';

export function useCurrentLocale(): SupportedLocale {
  const [locale, setLocale] = useState<SupportedLocale>(i18n.language as SupportedLocale);

  useEffect(() => {
    const handleLanguageChange = (nextLocale: string) => {
      setLocale(nextLocale as SupportedLocale);
    };

    i18n.on('languageChanged', handleLanguageChange);
    return () => {
      i18n.off('languageChanged', handleLanguageChange);
    };
  }, []);

  return locale;
}

export function useAntdLocale(): Locale | null {
  const locale = useCurrentLocale();
  const [antdLocale, setAntdLocale] = useState<Locale | null>(null);

  useEffect(() => {
    const loadAntdLocale = async () => {
      try {
        if (locale === 'zh-CN') {
          const mod = await import('antd/locale/zh_CN');
          setAntdLocale(mod.default);
          return;
        }
        const mod = await import('antd/locale/en_US');
        setAntdLocale(mod.default);
      } catch {
        setAntdLocale(null);
      }
    };

    void loadAntdLocale();
  }, [locale]);

  return antdLocale;
}
