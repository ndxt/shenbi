import type { ActionChain, ExpressionContext } from '@shenbi/schema';
import type { PageRuntime, StateAction } from '../types/contracts';

function setByPath(target: Record<string, any>, path: string, value: any) {
  const keys = path.split('.');
  let cursor: Record<string, any> = target;
  for (let i = 0; i < keys.length - 1; i += 1) {
    const key = keys[i]!;
    if (!cursor[key] || typeof cursor[key] !== 'object') {
      cursor[key] = {};
    }
    cursor = cursor[key];
  }
  cursor[keys[keys.length - 1]!] = value;
}

export interface MockRuntime extends PageRuntime {
  __executedActions: Array<{ actions: ActionChain; eventData?: any }>;
  __refs: Record<string, any>;
}

export function createMockRuntime(
  initialState: Record<string, any> = {},
  overrides: Partial<PageRuntime> = {},
): MockRuntime {
  const runtime: MockRuntime = {
    state: { ...initialState },
    computed: {},
    dialogPayloads: {},
    __executedActions: [],
    __refs: {},
    dispatch(action: StateAction) {
      if (action.type === 'SET') {
        setByPath(runtime.state, action.key, action.value);
      } else if (action.type === 'MERGE') {
        runtime.state = { ...runtime.state, ...action.data };
      } else if (action.type === 'RESET') {
        runtime.state = { ...action.initial };
      }
    },
    async executeActions(actions: ActionChain, eventData?: any) {
      runtime.__executedActions.push({ actions, eventData });
    },
    getContext(extra?: Partial<ExpressionContext>): ExpressionContext {
      return {
        state: runtime.state,
        params: {},
        computed: runtime.computed,
        ds: {},
        refs: runtime.__refs,
        utils: {},
        ...extra
      };
    },
    registerRef(id: string, ref: any) {
      runtime.__refs[id] = ref;
    },
    ...overrides
  };

  return runtime;
}
