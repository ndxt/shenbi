import type { ActionChain, ExpressionContext } from '@shenbi/schema';
import type { StateAction } from '../types/contracts';

export interface ExecutorOptions {
  methods: Record<string, any>;
  dataSources: Record<string, any>;
  refs: Record<string, any>;
}

export async function executeActions(
  _actions: ActionChain,
  _ctx: ExpressionContext,
  _dispatch: (action: StateAction) => void,
  _options: ExecutorOptions,
): Promise<void> {
  throw new Error('Not implemented: runtime/action-executor.ts');
}
