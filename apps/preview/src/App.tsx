import { useReducer, useMemo, useCallback, useRef } from 'react';
import * as antd from 'antd';
import { antdResolver, Container, setByPathImmutable } from '@shenbi/engine';
import { ShenbiPage } from '@shenbi/engine';
import { demoPageSchema } from './demo-schema';
import { demoCompiledBody } from './demo-compiled';
import type { ExpressionContext, ActionChain } from '@shenbi/schema';
import type { PageRuntime, StateAction } from '@shenbi/engine';

function stateReducer(state: Record<string, any>, action: StateAction) {
  switch (action.type) {
    case 'SET':
      return setByPathImmutable(state, action.key, action.value);
    case 'MERGE':
      return { ...state, ...action.data };
    case 'RESET':
      return { ...action.initial };
  }
}

function getInitialState(): Record<string, any> {
  const s: Record<string, any> = {};
  if (demoPageSchema.state) {
    for (const [key, def] of Object.entries(demoPageSchema.state)) {
      s[key] = def.default;
    }
  }
  return s;
}

const resolver = antdResolver(antd);
// Register builtins
resolver.register('Container', Container);

export function App() {
  const [state, dispatch] = useReducer(stateReducer, undefined, getInitialState);
  const refsMap = useRef<Record<string, any>>({});
  const executeActionsRef = useRef<(actions: ActionChain, eventData?: any) => Promise<void>>(
    null as any,
  );

  const executeActions = useCallback(
    async (actions: ActionChain, eventData?: any) => {
      for (const action of actions) {
        if (action.type === 'setState') {
          let val: any;
          if (typeof action.value === 'string' && action.value.startsWith('{{')) {
            // 简易表达式求值：处理 preview 中常见的几种模式
            const expr = action.value.slice(2, -2).trim();
            if (expr === 'event.target.value') {
              val = eventData?.target?.value;
            } else if (expr === 'event') {
              val = eventData;
            } else {
              val = eventData;
            }
          } else {
            val = action.value;
          }
          dispatch({ type: 'SET', key: action.key, value: val });
        } else if (action.type === 'callMethod') {
          const method = demoPageSchema.methods?.[action.name];
          if (method) {
            await executeActionsRef.current(method.body, eventData);
          }
        } else if (action.type === 'message') {
          antd.message.info(String(action.content));
        }
      }
    },
    [dispatch],
  );

  executeActionsRef.current = executeActions;

  const runtime: PageRuntime = useMemo(
    () => ({
      state,
      computed: {},
      dialogPayloads: {},
      dispatch,
      executeActions: (...args: Parameters<typeof executeActions>) =>
        executeActionsRef.current(...args),
      getContext(extra?: Partial<ExpressionContext>): ExpressionContext {
        return {
          state,
          params: {},
          computed: {},
          ds: {},
          refs: refsMap.current,
          utils: {},
          ...extra,
        };
      },
      registerRef(id: string, ref: any) {
        refsMap.current[id] = ref;
      },
    }),
    [state, dispatch],
  );

  return (
    <div style={{ padding: 24, maxWidth: 800, margin: '0 auto' }}>
      <ShenbiPage
        schema={demoPageSchema}
        resolver={resolver}
        runtime={runtime}
        compiledBody={demoCompiledBody}
      />
    </div>
  );
}
