import type { ExpressionContext } from '@shenbi/schema';
import type { CompiledExpression } from '../types/contracts';

export function compileExpression(_raw: string): CompiledExpression {
  throw new Error('Not implemented: compiler/expression.ts');
}

export function compileJSFunction(
  _params: string[],
  _body: string,
): (ctx: ExpressionContext, ...args: any[]) => any {
  throw new Error('Not implemented: compiler/expression.ts');
}
