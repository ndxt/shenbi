import React from 'react';
import { useTranslation } from '@shenbi/i18n';

export function StatusBar() {
  const { t } = useTranslation('editorUi');

  return (
    <div className="h-[22px] bg-bg-status-bar border-t border-border-ide flex items-center justify-between px-3 text-[12px] text-white shrink-0">
      <div className="flex items-center gap-4">
        <span>{t('statusBar.ready')}</span>
        <span>{t('statusBar.errors')}: 0</span>
        <span>{t('statusBar.warnings')}: 0</span>
      </div>
      <div className="flex items-center gap-4">
        <span>Schema: v1.0</span>
        <span>UTF-8</span>
        <span>TypeScript React</span>
      </div>
    </div>
  );
}
