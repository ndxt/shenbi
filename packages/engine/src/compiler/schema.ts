import type { SchemaNode } from '@shenbi/schema';
import type { ComponentResolver, CompiledNode } from '../types/contracts';

export function compileSchema(
  _node: SchemaNode | SchemaNode[],
  _resolver: ComponentResolver,
): CompiledNode | CompiledNode[] {
  throw new Error('Not implemented: compiler/schema.ts');
}
