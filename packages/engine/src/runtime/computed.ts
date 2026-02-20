import type { PageSchema } from '@shenbi/schema';
import type { ExpressionContext } from '@shenbi/schema';
import { useMemo, useRef } from 'react';
import type { CompiledExpression } from '../types/contracts';
import { compileExpression } from '../compiler/expression';

interface ComputedCacheEntry {
  signature: string;
  value: any;
}

function serializeDepValues(values: any[]): string {
  try {
    return JSON.stringify(values);
  } catch (_error) {
    return values.map((value) => String(value)).join('|');
  }
}

function readDepValue(
  path: string,
  state: Record<string, any>,
  computed: Record<string, any>,
): any {
  const parts = path.split('.').filter(Boolean);
  if (parts.length === 0) {
    return undefined;
  }

  const [root, ...rest] = parts;
  let cursor: any;
  if (root === 'state') {
    cursor = state;
  } else if (root === 'computed') {
    cursor = computed;
  } else {
    return undefined;
  }

  for (const key of rest) {
    if (cursor == null) {
      return undefined;
    }
    cursor = cursor[key];
  }

  return cursor;
}

function buildComputedContext(
  state: Record<string, any>,
  computed: Record<string, any>,
): ExpressionContext {
  return {
    state,
    params: {},
    computed,
    ds: {},
    utils: {},
    refs: {},
  };
}

export function useComputed(
  computedDef: PageSchema['computed'],
  state: Record<string, any>,
): Record<string, any> {
  const compiledMap = useMemo<Record<string, CompiledExpression>>(() => {
    const output: Record<string, CompiledExpression> = {};
    for (const [name, def] of Object.entries(computedDef ?? {})) {
      output[name] = compileExpression(def.expr);
    }
    return output;
  }, [computedDef]);

  const cacheRef = useRef<Record<string, ComputedCacheEntry>>({});

  return useMemo(() => {
    const defs = computedDef ?? {};
    const nextValues: Record<string, any> = {};
    const nextCache: Record<string, ComputedCacheEntry> = {};
    const resolved = new Set<string>();
    const visiting = new Set<string>();

    const evaluate = (name: string): any => {
      if (resolved.has(name)) {
        return nextValues[name];
      }

      if (visiting.has(name)) {
        const chain = [...visiting, name].join(' -> ');
        throw new Error(`检测到 computed 循环依赖: ${chain}`);
      }

      const def = defs[name];
      if (!def) {
        return undefined;
      }

      visiting.add(name);
      const depValues = (def.deps ?? []).map((depPath) => {
        if (depPath.startsWith('computed.')) {
          const target = depPath.slice('computed.'.length);
          if (target && defs[target]) {
            evaluate(target);
          }
        }
        return readDepValue(depPath, state, nextValues);
      });

      const signature = serializeDepValues(depValues);
      const prev = cacheRef.current[name];

      let value: any;
      if (prev && prev.signature === signature) {
        value = prev.value;
      } else {
        const expr = compiledMap[name];
        value = expr?.fn(buildComputedContext(state, nextValues));
      }

      nextValues[name] = value;
      nextCache[name] = { signature, value };
      resolved.add(name);
      visiting.delete(name);
      return value;
    };

    for (const name of Object.keys(defs)) {
      evaluate(name);
    }

    cacheRef.current = nextCache;
    return nextValues;
  }, [compiledMap, computedDef, state]);
}
