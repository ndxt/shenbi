import type { ActionChain } from './action';
import type { DataSourceDef } from './datasource';
import type { JSExpression } from './expression';
import type { SchemaNode } from './node';

export interface StateFieldDef {
  type?: string;
  default?: any;
}

export interface ComputedFieldDef {
  deps: string[];
  expr: JSExpression;
}

export interface MethodDef {
  params?: string[];
  body: ActionChain;
}

export interface WatcherDef {
  watch: string | string[];
  handler: ActionChain;
  immediate?: boolean;
  debounce?: number;
  throttle?: number;
  deep?: boolean;
}

export interface LifecycleDef {
  onLoad?: ActionChain;
  onMount?: ActionChain;
  onUnmount?: ActionChain;
}

export interface SyncToUrlDef {
  stateKey: string;
  queryKey?: string;
  transform?: 'string' | 'number' | 'boolean' | 'json';
}

export interface PageSchema {
  id?: string;
  name?: string;
  state?: Record<string, StateFieldDef>;
  params?: Record<string, any>;
  computed?: Record<string, ComputedFieldDef>;
  methods?: Record<string, MethodDef>;
  watchers?: WatcherDef[];
  dataSources?: Record<string, DataSourceDef>;
  body: SchemaNode | SchemaNode[];
  dialogs?: SchemaNode[];
  syncToUrl?: SyncToUrlDef[];
  templates?: Record<string, SchemaNode>;
  lifecycle?: LifecycleDef;
}
