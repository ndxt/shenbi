export interface ComponentPropContract {
  name: string;
  type: string;
  required?: boolean;
  description?: string;
}

export interface ComponentEventContract {
  name: string;
  params?: string[];
  description?: string;
}

export interface ComponentSlotContract {
  name: string;
  description?: string;
}

export interface ComponentContract {
  componentType: string;
  component?: unknown;
  props?: ComponentPropContract[];
  events?: ComponentEventContract[];
  slots?: ComponentSlotContract[];
}

export interface Diagnostic {
  level: 'error' | 'warning' | 'info';
  message: string;
  path?: string;
  code?: string;
}
