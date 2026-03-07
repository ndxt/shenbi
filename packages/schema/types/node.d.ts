import type { ActionChain } from './action';
import type { FormRule } from './datasource';
import type { PropValue } from './expression';
export interface LoopDirective {
    data: PropValue;
    itemKey?: string;
    indexKey?: string;
    key?: PropValue;
}
export interface ColumnSchema {
    title?: PropValue;
    dataIndex?: string;
    key?: string;
    width?: number | string;
    align?: 'left' | 'center' | 'right';
    render?: SchemaNode;
    editRender?: SchemaNode;
    if?: PropValue;
    editRules?: FormRule[];
    [key: string]: unknown;
}
export interface EditorConfig {
    label?: string;
    group?: string;
    sortable?: boolean;
}
export interface SchemaNode {
    id?: string;
    component: string;
    props?: Record<string, PropValue>;
    style?: Record<string, PropValue> | PropValue;
    className?: PropValue;
    if?: PropValue;
    show?: PropValue;
    loop?: LoopDirective;
    slots?: Record<string, SchemaNode | SchemaNode[]>;
    columns?: ColumnSchema[];
    children?: SchemaNode[] | PropValue;
    events?: Record<string, ActionChain>;
    permission?: string;
    errorBoundary?: {
        fallback: SchemaNode;
    };
    editor?: EditorConfig;
    [key: string]: unknown;
}
//# sourceMappingURL=node.d.ts.map