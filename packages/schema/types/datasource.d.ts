import type { ActionChain } from './action';
import type { JSFunctionDef, PropValue } from './expression';
export interface TypeDef {
    name: string;
    type: string;
    required?: boolean;
    description?: string;
}
export interface DataSchema {
    fields: TypeDef[];
}
export interface APISchema {
    method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    url: PropValue;
    headers?: Record<string, PropValue>;
    params?: Record<string, PropValue>;
    data?: PropValue;
}
export interface FormRule {
    required?: boolean;
    message?: string;
    pattern?: string;
    min?: number;
    max?: number;
    validator?: JSFunctionDef;
}
export interface DataSourceDef {
    api: APISchema;
    auto?: boolean;
    deps?: string[];
    debounce?: number;
    transform?: JSFunctionDef;
    onSuccess?: ActionChain;
    onError?: ActionChain;
    onFinally?: ActionChain;
}
//# sourceMappingURL=datasource.d.ts.map