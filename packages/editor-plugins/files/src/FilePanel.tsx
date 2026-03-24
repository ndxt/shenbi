import React from 'react';
import { useTranslation } from '@shenbi/i18n';
import './i18n';

export interface FilePanelFileItem {
  id: string;
  name: string;
  updatedAt: number;
  size?: number;
}

export interface FilePanelProps {
  files: FilePanelFileItem[];
  activeFileId: string | undefined;
  status: string;
  onOpenFile: (fileId: string) => void;
  onSaveFile: () => void;
  onSaveAsFile: () => void;
  onRefresh: () => void;
}

export function FilePanel({
  files,
  activeFileId,
  status,
  onOpenFile,
  onSaveFile,
  onSaveAsFile,
  onRefresh,
}: FilePanelProps) {
  const { t } = useTranslation('pluginFiles');

  return (
    <div className="h-full flex flex-col text-xs text-text-primary">
      <div className="flex items-center gap-2 p-3 border-b border-border-ide">
        <button
          type="button"
          className="h-7 rounded border border-border-ide bg-bg-panel px-2 text-[12px] text-text-primary transition-colors hover:bg-bg-activity-bar"
          onClick={onSaveFile}
        >
          {t('filePanel.save')}
        </button>
        <button
          type="button"
          className="h-7 rounded border border-border-ide bg-bg-panel px-2 text-[12px] text-text-primary transition-colors hover:bg-bg-activity-bar"
          onClick={onSaveAsFile}
        >
          {t('filePanel.saveAs')}
        </button>
        <button
          type="button"
          className="h-7 rounded border border-border-ide bg-bg-panel px-2 text-[12px] text-text-primary transition-colors hover:bg-bg-activity-bar"
          onClick={onRefresh}
        >
          {t('filePanel.refresh')}
        </button>
      </div>
      <div className="px-3 py-2 text-[11px] text-text-secondary border-b border-border-ide">
        {status}
      </div>
      <div className="flex-1 overflow-auto p-2 space-y-2">
        {files.length === 0 ? (
          <div className="rounded border border-dashed border-border-ide p-3 text-[11px] text-text-secondary">
            {t('filePanel.empty')}
          </div>
        ) : (
          files.map((file) => (
            <div
              key={file.id}
              className={`rounded border px-2 py-2 ${
                file.id === activeFileId
                  ? 'border-primary bg-bg-activity-bar'
                  : 'border-border-ide bg-bg-panel'
              }`}
            >
              <div className="truncate text-[12px] text-text-primary">{file.name}</div>
              <div className="mt-1 text-[11px] text-text-secondary">
                {new Date(file.updatedAt).toLocaleString()}
              </div>
              <button
                type="button"
                className="mt-2 h-6 rounded border border-border-ide px-2 text-[11px] transition-colors hover:bg-bg-sidebar"
                onClick={() => onOpenFile(file.id)}
              >
                {t('filePanel.open')}
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
