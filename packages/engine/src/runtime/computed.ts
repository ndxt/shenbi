import type { PageSchema } from '@shenbi/schema';

export function useComputed(
  _computedDef: PageSchema['computed'],
  _state: Record<string, any>,
): Record<string, any> {
  throw new Error('Not implemented: runtime/computed.ts');
}
