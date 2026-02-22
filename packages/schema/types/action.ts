import type { PropValue } from './expression';

export interface BaseAction {
  type: string;
}

export interface SetStateAction extends BaseAction {
  type: 'setState';
  key: string;
  value: PropValue;
}

export interface CallMethodAction extends BaseAction {
  type: 'callMethod';
  name: string;
  params?: Record<string, PropValue>;
}

export interface FetchAction extends BaseAction {
  type: 'fetch';
  datasource?: string;
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  url?: PropValue;
  headers?: Record<string, PropValue>;
  params?: Record<string, PropValue>;
  data?: PropValue;
  onSuccess?: ActionChain;
  onError?: ActionChain;
  onFinally?: ActionChain;
}

export interface NavigateAction extends BaseAction {
  type: 'navigate';
  to?: PropValue;
  replace?: boolean;
  back?: boolean;
}

export interface MessageAction extends BaseAction {
  type: 'message';
  level?: 'info' | 'success' | 'warning' | 'error' | 'loading';
  content: PropValue;
}

export interface NotificationAction extends BaseAction {
  type: 'notification';
  level?: 'info' | 'success' | 'warning' | 'error';
  message: PropValue;
  description?: PropValue;
}

export interface ConfirmAction extends BaseAction {
  type: 'confirm';
  confirmType?: 'confirm' | 'info' | 'success' | 'warning' | 'error';
  title: PropValue;
  content?: PropValue;
  onOk?: ActionChain;
  onCancel?: ActionChain;
}

export interface ModalAction extends BaseAction {
  type: 'modal';
  id: string;
  open: boolean;
  payload?: PropValue;
}

export interface DrawerAction extends BaseAction {
  type: 'drawer';
  id: string;
  open: boolean;
  payload?: PropValue;
}

export interface ValidateAction extends BaseAction {
  type: 'validate';
  formRef: string;
  onSuccess?: ActionChain;
  onError?: ActionChain;
}

export interface ResetFormAction extends BaseAction {
  type: 'resetForm';
  formRef: string;
  fields?: string[];
}

export interface ConditionAction extends BaseAction {
  type: 'condition';
  if: PropValue;
  then?: ActionChain;
  else?: ActionChain;
}

export interface LoopAction extends BaseAction {
  type: 'loop';
  data: PropValue;
  itemKey?: string;
  indexKey?: string;
  body: ActionChain;
}

export interface ScriptAction extends BaseAction {
  type: 'script';
  code: string;
}

export interface CopyAction extends BaseAction {
  type: 'copy';
  text: PropValue;
}

export interface DebounceAction extends BaseAction {
  type: 'debounce';
  wait: number;
  body: ActionChain;
}

export interface ThrottleAction extends BaseAction {
  type: 'throttle';
  wait: number;
  body: ActionChain;
}

export interface BatchAction extends BaseAction {
  type: 'batch';
  actions: ActionChain;
}

export interface EmitAction extends BaseAction {
  type: 'emit';
  event: string;
  payload?: PropValue;
}

export interface CallPropAction extends BaseAction {
  type: 'callProp';
  name: string;
  args?: PropValue[];
}

export interface SetQueryAction extends BaseAction {
  type: 'setQuery';
  query: Record<string, PropValue>;
}

export interface DownloadAction extends BaseAction {
  type: 'download';
  url: PropValue;
  filename?: PropValue;
}

export type Action =
  | SetStateAction
  | CallMethodAction
  | FetchAction
  | NavigateAction
  | MessageAction
  | NotificationAction
  | ConfirmAction
  | ModalAction
  | DrawerAction
  | ValidateAction
  | ResetFormAction
  | ConditionAction
  | LoopAction
  | ScriptAction
  | CopyAction
  | DebounceAction
  | ThrottleAction
  | BatchAction
  | EmitAction
  | CallPropAction
  | SetQueryAction
  | DownloadAction;

export type ActionChain = Action[];
