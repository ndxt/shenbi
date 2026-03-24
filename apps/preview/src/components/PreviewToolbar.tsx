import { FileDown, FileUp, Redo2, Undo2 } from 'lucide-react';
import type { ChangeEvent, RefObject } from 'react';
import type { AppMode, RenderMode, ScenarioKey } from '../preview-types';

interface Option<T extends string> {
  label: string;
  value: T;
}

interface PreviewToolbarProps {
  previewT: (...args: any[]) => string;
  appMode: AppMode;
  activeScenario: ScenarioKey;
  scenarioOptions: Option<ScenarioKey>[];
  onActiveScenarioChange: (scenario: ScenarioKey) => void;
  fileInputRef: RefObject<HTMLInputElement | null>;
  onImportJSONFile: (event: ChangeEvent<HTMLInputElement>) => void | Promise<void>;
  onExportJSON: () => void;
  isDirty: boolean;
  canUndo: boolean;
  canRedo: boolean;
  shellGenerationLock: boolean;
  onUndo: () => void;
  onRedo: () => void;
}

export function PreviewToolbar({
  previewT,
  appMode,
  activeScenario,
  scenarioOptions,
  onActiveScenarioChange,
  fileInputRef,
  onImportJSONFile,
  onExportJSON,
  isDirty: _isDirty,
  canUndo,
  canRedo,
  shellGenerationLock,
  onUndo,
  onRedo,
}: PreviewToolbarProps) {
  return (
    <div className="flex items-center gap-2">
      {appMode === 'scenarios' ? (
        <>
          <span className="text-text-secondary" style={{ fontSize: '11px' }}>
            {previewT('scenario')}
          </span>
          <select
            className="h-7 w-[180px] rounded border border-border-ide bg-bg-panel px-2 text-text-primary outline-none transition-colors hover:bg-bg-activity-bar focus:border-blue-500"
            style={{ fontSize: '12px' }}
            aria-label={previewT('aria.scenarioSwitch')}
            value={activeScenario}
            onChange={(event) => onActiveScenarioChange(event.target.value as ScenarioKey)}
          >
            {scenarioOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </>
      ) : null}
      {appMode === 'shell' ? (
        <>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            className="hidden"
            style={{ display: 'none' }}
            onChange={onImportJSONFile}
          />
          <button
            type="button"
            aria-label={previewT('toolbar.importJSON')}
            className="p-1.5 rounded text-text-secondary transition-colors hover:bg-bg-activity-bar hover:text-text-primary"
            onClick={() => fileInputRef.current?.click()}
            title={previewT('toolbar.importJSON')}
          >
            <FileUp size={15} />
          </button>
          <button
            type="button"
            aria-label="导出 JSON 文件"
            className="p-1.5 rounded text-text-secondary transition-colors hover:bg-bg-activity-bar hover:text-text-primary"
            onClick={onExportJSON}
            title="导出 JSON 文件"
          >
            <FileDown size={15} />
          </button>
          <button
            type="button"
            aria-label={previewT('toolbar.undo')}
            className="p-1.5 rounded text-text-secondary transition-colors hover:bg-bg-activity-bar hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-40"
            disabled={!canUndo || shellGenerationLock}
            onClick={onUndo}
            title={previewT('toolbar.undo')}
          >
            <Undo2 size={15} />
          </button>
          <button
            type="button"
            aria-label={previewT('toolbar.redo')}
            className="p-1.5 rounded text-text-secondary transition-colors hover:bg-bg-activity-bar hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-40"
            disabled={!canRedo || shellGenerationLock}
            onClick={onRedo}
            title={previewT('toolbar.redo')}
          >
            <Redo2 size={15} />
          </button>
        </>
      ) : null}
    </div>
  );
}
