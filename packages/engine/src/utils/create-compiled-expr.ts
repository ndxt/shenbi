import type { ExpressionContext } from '@shenbi/schema';
import type { CompiledExpression } from '../types/contracts';

/**
 * 快捷构造 CompiledExpression。
 * 用于测试和手动构建预编译节点。
 */
export function createCompiledExpr(
  raw: string,
  fn: (ctx: ExpressionContext) => any,
  deps: string[] = [],
): CompiledExpression {
  return { raw, fn, deps };
}
