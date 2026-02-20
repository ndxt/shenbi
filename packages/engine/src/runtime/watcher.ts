import type { PageSchema } from '@shenbi/schema';
import type { ActionChain } from '@shenbi/schema';

export function useWatchers(
  _watchers: PageSchema['watchers'],
  _state: Record<string, any>,
  _executeActions: (actions: ActionChain) => Promise<void>,
): void {
  throw new Error('Not implemented: runtime/watcher.ts');
}
