import type { PageSchema } from '@shenbi/schema';
import type { StateAction } from '../types/contracts';

export interface PageStateController {
  state: Record<string, any>;
  dispatch: (action: StateAction) => void;
}

export function usePageState(_page: PageSchema): PageStateController {
  throw new Error('Not implemented: runtime/state.ts');
}
