import type { ExpressionContext, JSFunctionDef, PropValue } from '@shenbi/schema';
import type { CompiledExpression } from '../types/contracts';

type LegacyJSExpressionDef = { __type: 'JSExpression'; value: string };
type LegacyJSFunctionDef = { __type: 'JSFunction'; params?: string[]; body: string };

type MaybeJSExpressionDef = LegacyJSExpressionDef | { type: 'JSExpression'; value: string };
type MaybeJSFunctionDef = LegacyJSFunctionDef | JSFunctionDef;

const EXPRESSION_RE = /^\s*\{\{([\s\S]*)\}\}\s*$/;
const PATH_DEP_RE = /\b(state|params|computed|ds|refs|utils|event|watch)(?:(?:\.|\?\.)[A-Za-z_$][\w$]*)+/g;
const VALID_IDENTIFIER_RE = /^[A-Za-z_$][\w$]*$/;

function pickExpressionSource(raw: string): string {
  const match = raw.match(EXPRESSION_RE);
  if (match) {
    return match[1]?.trim() ?? '';
  }
  return raw.trim();
}

function normalizeDepPath(path: string): string {
  return path.replace(/\?\./g, '.');
}

function trimCalledSegment(path: string, source: string, sourceIndex: number): string {
  let output = path;
  while (output.includes('.')) {
    const nextChar = source[sourceIndex + output.length];
    if (nextChar !== '(') {
      break;
    }
    const lastDotIndex = output.lastIndexOf('.');
    if (lastDotIndex <= 0) {
      break;
    }
    output = output.slice(0, lastDotIndex);
  }
  return output;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object';
}

export function isExpression(value: unknown): value is string {
  return typeof value === 'string' && EXPRESSION_RE.test(value);
}

function isJSExpressionDef(value: unknown): value is MaybeJSExpressionDef {
  if (!isObject(value)) {
    return false;
  }
  return (
    (value.type === 'JSExpression' || value.__type === 'JSExpression') &&
    typeof value.value === 'string'
  );
}

function isJSFunctionDef(value: unknown): value is MaybeJSFunctionDef {
  if (!isObject(value)) {
    return false;
  }
  const type = value.type ?? value.__type;
  return type === 'JSFunction' && typeof value.body === 'string';
}

export function extractDeps(rawExpr: string): string[] {
  const expr = pickExpressionSource(rawExpr);
  if (!expr) {
    return [];
  }

  const output = new Set<string>();
  const matches = expr.matchAll(PATH_DEP_RE);
  for (const match of matches) {
    const fullPath = match[0];
    const index = match.index;
    if (!fullPath || index == null) {
      continue;
    }
    const normalized = normalizeDepPath(fullPath);
    const trimmed = trimCalledSegment(normalized, expr, index);
    if (trimmed.includes('.')) {
      output.add(trimmed);
    }
  }

  return [...output];
}

function createExpressionExecutor(expr: string): (ctx: ExpressionContext) => any {
  if (!expr) {
    return () => undefined;
  }

  let evaluator: ((ctx: ExpressionContext) => any) | null = null;
  try {
    evaluator = new Function(
      'ctx',
      `
        try {
          const scope = ctx ?? {};
          return (function(__scope) {
            with (__scope) {
              return (${expr});
            }
          })(scope);
        } catch (_error) {
          return undefined;
        }
      `,
    ) as (ctx: ExpressionContext) => any;
  } catch (_error) {
    evaluator = null;
  }

  if (!evaluator) {
    return () => undefined;
  }
  return (ctx: ExpressionContext) => evaluator?.(ctx) ?? undefined;
}

export function compileExpression(raw: string): CompiledExpression {
  const expr = pickExpressionSource(raw);
  return {
    raw,
    deps: extractDeps(raw),
    fn: createExpressionExecutor(expr),
  };
}

export function compileJSFunction(
  params: string[],
  body: string,
): (ctx: ExpressionContext, ...args: any[]) => any {
  const safeParams = params.map((param, index) =>
    VALID_IDENTIFIER_RE.test(param) ? param : `arg${index}`,
  );

  let compiled: ((ctx: ExpressionContext, ...args: any[]) => any) | null = null;
  try {
    compiled = new Function(
      'ctx',
      ...safeParams,
      `
        try {
          const scope = ctx ?? {};
          return (function(__scope) {
            with (__scope) {
              ${body}
            }
          })(scope);
        } catch (_error) {
          return undefined;
        }
      `,
    ) as (ctx: ExpressionContext, ...args: any[]) => any;
  } catch (_error) {
    compiled = null;
  }

  if (!compiled) {
    return () => undefined;
  }

  return (ctx: ExpressionContext, ...args: any[]) => compiled?.(ctx, ...args) ?? undefined;
}

export function compilePropValue(
  value: PropValue | LegacyJSExpressionDef | LegacyJSFunctionDef | unknown,
): CompiledExpression | ((ctx: ExpressionContext, ...args: any[]) => any) | null {
  if (isExpression(value)) {
    return compileExpression(value);
  }

  if (isJSExpressionDef(value)) {
    return compileExpression(value.value);
  }

  if (isJSFunctionDef(value)) {
    return compileJSFunction(value.params ?? [], value.body);
  }

  return null;
}
