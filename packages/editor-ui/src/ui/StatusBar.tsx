import React from 'react';
import {
  changeLanguage,
  type SupportedLocale,
  useCurrentLocale,
  useTranslation,
} from '@shenbi/i18n';

export function StatusBar() {
  const { t } = useTranslation('editorUi');
  const currentLocale = useCurrentLocale();

  const handleLanguageChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    void changeLanguage(event.target.value as SupportedLocale);
  };

  return (
    <div className="h-[22px] bg-bg-status-bar border-t border-border-ide flex items-center justify-between px-3 text-[12px] text-white shrink-0">
      <div className="flex items-center gap-4">
        <span>{t('statusBar.ready')}</span>
        <span>{t('statusBar.errors')}: 0</span>
        <span>{t('statusBar.warnings')}: 0</span>
      </div>
      <div className="flex items-center gap-4">
        <select
          value={currentLocale}
          onChange={handleLanguageChange}
          className="bg-transparent border-none text-white text-[12px] cursor-pointer outline-none"
          aria-label={t('statusBar.language')}
        >
          <option value="zh-CN" className="bg-bg-panel text-text-primary">简体中文</option>
          <option value="en-US" className="bg-bg-panel text-text-primary">English</option>
        </select>
        <span>Schema: v1.0</span>
        <span>UTF-8</span>
        <span>TypeScript React</span>
      </div>
    </div>
  );
}
