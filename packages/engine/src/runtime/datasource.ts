import type { ActionChain, PageSchema } from '@shenbi/schema';

export function useDataSources(
  _dataSources: PageSchema['dataSources'],
  _state: Record<string, any>,
  _executeActions: (actions: ActionChain) => Promise<void>,
): Record<string, any> {
  throw new Error('Not implemented: runtime/datasource.ts');
}
