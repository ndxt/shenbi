export interface UserRecord {
  id: number;
  name: string;
  email: string;
  status: 'enabled' | 'disabled';
  role: 'admin' | 'operator' | 'viewer';
  createdAt: string;
}

export interface UserListQuery {
  keyword?: string;
  status?: string;
  page: number;
  pageSize: number;
  sortField?: string | null;
  sortOrder?: 'ascend' | 'descend' | null;
}

export interface UserListResult {
  list: UserRecord[];
  total: number;
}

export interface CrudUiStateView {
  loading: boolean;
  selectedRowKeys: Array<string | number>;
  pagination: {
    current: number;
    pageSize: number;
  };
}

export interface CrudUiActions {
  reload(): Promise<void>;
  setKeyword(keyword: string): void;
  setStatus(status: string): void;
  setPage(page: number, pageSize?: number): void;
}

export interface CrudPublicApi {
  state: CrudUiStateView;
  query: UserListQuery;
  users: UserListResult;
  actions: CrudUiActions;
}
