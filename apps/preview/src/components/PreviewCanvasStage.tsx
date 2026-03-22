import { ScenarioRuntimeView } from '../runtime/ScenarioRuntimeView';
import type { PageSchema } from '@shenbi/schema';

interface PreviewCanvasStageProps {
  appMode: string;
  activeScenario: string;
  schema: PageSchema;
  shellGenerationLock: boolean;
  shellGenerationReason: string;
}

export function PreviewCanvasStage({
  appMode,
  activeScenario,
  schema,
  shellGenerationLock,
  shellGenerationReason,
}: PreviewCanvasStageProps) {
  return (
    <div className="relative min-h-full">
      {shellGenerationLock ? (
        <div className="absolute right-3 top-3 z-20 rounded border border-blue-500/40 bg-bg-panel/90 px-3 py-1.5 text-[11px] text-text-secondary shadow-sm">
          {shellGenerationReason}
        </div>
      ) : null}
      <div className={shellGenerationLock ? 'pointer-events-none select-none' : undefined}>
        <ScenarioRuntimeView key={`${appMode}:${activeScenario}`} schema={schema} />
      </div>
    </div>
  );
}
