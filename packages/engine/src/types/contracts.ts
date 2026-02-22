import type { ComponentType } from 'react';
import type {
  ActionChain,
  ColumnSchema,
  ExpressionContext,
  FormRule,
  SchemaNode
} from '@shenbi/schema';

export interface CompiledExpression {
  fn: (ctx: ExpressionContext) => any;
  deps: string[];
  raw: string;
}

export interface CompiledColumn {
  config: Record<string, any>;
  dynamicConfig?: Record<string, CompiledExpression>;
  compiledRender?: CompiledNode;
  renderParams?: string[];
  compiledEditRender?: CompiledNode;
  editRenderParams?: string[];
  ifFn?: CompiledExpression;
  editRules?: FormRule[];
}

export interface CompiledLoop {
  dataFn: CompiledExpression;
  itemKey: string;
  indexKey: string;
  keyFn: CompiledExpression;
  body: CompiledNode;
}

export interface CompiledNode {
  id?: string;
  Component: ComponentType<any> | string | null;
  componentType: string;
  staticProps: Record<string, any>;
  dynamicProps: Record<string, CompiledExpression>;
  ifFn?: CompiledExpression;
  showFn?: CompiledExpression;
  childrenFn?: CompiledExpression;
  compiledChildren?: CompiledNode[];
  compiledSlots?: Record<string, CompiledNode | CompiledNode[]>;
  compiledColumns?: CompiledColumn[];
  loop?: CompiledLoop;
  events?: Record<string, ActionChain>;
  style?: Record<string, any> | CompiledExpression;
  className?: string | CompiledExpression;
  permission?: string;
  errorBoundary?: { fallback: CompiledNode };
  allDeps: string[];
  __raw?: SchemaNode;
}

export type StateAction =
  | { type: 'SET'; key: string; value: any }
  | { type: 'MERGE'; data: Record<string, any> }
  | { type: 'RESET'; initial: Record<string, any> };

export interface PageRuntime {
  state: Record<string, any>;
  dispatch: (action: StateAction) => void;
  executeActions: (actions: ActionChain, eventData?: any, extraContext?: Record<string, any>) => Promise<void>;
  getContext: (extra?: Partial<ExpressionContext>) => ExpressionContext;
  computed: Record<string, any>;
  dialogPayloads: Record<string, any>;
  registerRef: (id: string, ref: any) => void;
}

export interface ComponentResolver {
  resolve(componentType: string): ComponentType<any> | string | null;
  register(componentType: string, component: ComponentType<any>): void;
  registerAll(map: Record<string, ComponentType<any>>): void;
  has(componentType: string): boolean;
}

export interface ShenbiContextValue {
  runtime: PageRuntime;
  resolver: ComponentResolver;
}
