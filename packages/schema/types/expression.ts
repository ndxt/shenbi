export type JSExpression = string;

export interface JSFunctionDef {
  type: 'JSFunction';
  params?: string[];
  body: string;
}

export interface SchemaRender {
  type: 'SchemaRender';
  schema: unknown;
}

export type Primitive = string | number | boolean | null | undefined;

export interface PropObject {
  [key: string]: PropValue;
}

export interface PropArray extends Array<PropValue> {}

export type PropValue =
  | Primitive
  | JSExpression
  | JSFunctionDef
  | SchemaRender
  | PropObject
  | PropArray;

export interface ExpressionContext {
  state: Record<string, any>;
  params: Record<string, any>;
  computed: Record<string, any>;
  ds: Record<string, any>;
  utils: Record<string, any>;
  refs: Record<string, any>;
  event?: any;
  loop?: Record<string, any>;
  watch?: {
    newValue: any;
    oldValue: any;
  };
  [key: string]: any;
}
