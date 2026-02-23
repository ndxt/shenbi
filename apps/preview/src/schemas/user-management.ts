import type { PageSchema } from '@shenbi/schema';

export const userManagementSchema: PageSchema = {
  id: 'user-management',
  name: '用户管理',
  state: {
    userList: { default: [] },
    total: { default: 0 },
    loading: { default: false },
    keyword: { default: '' },
    statusFilter: { default: '' },
    dateRange: { default: null },
    pagination: {
      default: {
        current: 1,
        pageSize: 10,
      },
    },
    sorter: {
      default: {
        field: null,
        order: null,
      },
    },
    selectedRowKeys: { default: [] },
    editingRowId: { default: null },
    editingData: { default: {} },
    dialogMode: { default: null },
    currentRecord: { default: null },
  },
  computed: {
    selectedCount: {
      deps: ['state.selectedRowKeys'],
      expr: '{{state.selectedRowKeys.length}}',
    },
    isInlineEditing: {
      deps: ['state.editingRowId'],
      expr: '{{state.editingRowId != null}}',
    },
  },
  methods: {
    fetchUsers: {
      body: [
        { type: 'setState', key: 'loading', value: true },
        {
          type: 'fetch',
          datasource: 'userList',
          onSuccess: [
            { type: 'setState', key: 'userList', value: '{{response.data.list}}' },
            { type: 'setState', key: 'total', value: '{{response.data.total}}' },
          ],
          onFinally: [{ type: 'setState', key: 'loading', value: false }],
        },
      ],
    },
    openAddDialog: {
      body: [
        { type: 'setState', key: 'dialogMode', value: 'add' },
        {
          type: 'setState',
          key: 'currentRecord',
          value: '{{ { name: "", email: "", status: "enabled", role: "viewer", permissionGroup: "" } }}',
        },
        {
          type: 'modal',
          id: 'userDialog',
          open: true,
          payload: '{{state.currentRecord}}',
        },
      ],
    },
    openEditDialog: {
      params: ['record'],
      body: [
        { type: 'setState', key: 'dialogMode', value: 'edit' },
        {
          type: 'setState',
          key: 'currentRecord',
          value: '{{ { ...params.record } }}',
        },
        {
          type: 'modal',
          id: 'userDialog',
          open: true,
          payload: '{{params.record}}',
        },
      ],
    },
    closeUserDialog: {
      body: [
        { type: 'modal', id: 'userDialog', open: false },
        { type: 'resetForm', formRef: 'user-dialog-form' },
        { type: 'setState', key: 'dialogMode', value: null },
        { type: 'setState', key: 'currentRecord', value: null },
      ],
    },
  },
  dataSources: {
    userList: {
      api: {
        method: 'GET',
        url: '/api/users',
        params: {
          keyword: '{{state.keyword}}',
          status: '{{state.statusFilter}}',
          page: '{{state.pagination.current}}',
          pageSize: '{{state.pagination.pageSize}}',
          sortField: '{{state.sorter.field}}',
          sortOrder: '{{state.sorter.order}}',
        },
      },
    },
    createUser: {
      api: {
        method: 'POST',
        url: '/api/users',
        data: '{{state.currentRecord}}',
      },
    },
    updateUser: {
      api: {
        method: 'PUT',
        url: '{{"/api/users/" + state.currentRecord.id}}',
        data: '{{state.currentRecord}}',
      },
    },
    deleteUser: {
      api: {
        method: 'DELETE',
        url: '{{"/api/users/" + state.currentRecord.id}}',
      },
    },
  },
  watchers: [
    {
      watch: ['state.keyword', 'state.statusFilter'],
      debounce: 300,
      handler: [
        { type: 'setState', key: 'pagination.current', value: 1 },
        { type: 'callMethod', name: 'fetchUsers' },
      ],
    },
  ],
  syncToUrl: [
    { stateKey: 'keyword', queryKey: 'keyword', transform: 'string' },
    { stateKey: 'statusFilter', queryKey: 'status', transform: 'string' },
    { stateKey: 'pagination.current', queryKey: 'page', transform: 'number' },
  ],
  dialogs: [
    {
      id: 'userDialog',
      component: 'Modal',
      props: {
        open: true,
        destroyOnClose: true,
        maskClosable: false,
        title: '{{state.dialogMode === "edit" ? "编辑用户" : "新增用户"}}',
      },
      events: {
        onCancel: [{ type: 'callMethod', name: 'closeUserDialog' }],
      },
      slots: {
        footer: {
          component: 'Space',
          props: {
            style: { width: '100%', justifyContent: 'flex-end' },
          },
          children: [
            {
              component: 'Button',
              children: '取消',
              events: {
                onClick: [{ type: 'callMethod', name: 'closeUserDialog' }],
              },
            },
            {
              component: 'Button',
              props: { type: 'primary' },
              children: '保存',
              events: {
                onClick: [
                  {
                    type: 'validate',
                    formRef: 'user-dialog-form',
                    onSuccess: [
                      { type: 'setState', key: 'currentRecord', value: '{{ { ...state.currentRecord, ...values } }}' },
                      {
                        type: 'condition',
                        if: '{{state.dialogMode === "edit"}}',
                        then: [
                          {
                            type: 'fetch',
                            datasource: 'updateUser',
                            data: '{{values}}',
                            onSuccess: [
                              { type: 'message', level: 'success', content: '保存成功' },
                              { type: 'callMethod', name: 'closeUserDialog' },
                              { type: 'callMethod', name: 'fetchUsers' },
                            ],
                            onError: [{ type: 'message', level: 'error', content: '保存失败' }],
                          },
                        ],
                        else: [
                          {
                            type: 'fetch',
                            datasource: 'createUser',
                            data: '{{values}}',
                            onSuccess: [
                              { type: 'message', level: 'success', content: '新增成功' },
                              { type: 'callMethod', name: 'closeUserDialog' },
                              { type: 'callMethod', name: 'fetchUsers' },
                            ],
                            onError: [{ type: 'message', level: 'error', content: '新增失败' }],
                          },
                        ],
                      },
                    ],
                    onError: [{ type: 'message', level: 'error', content: '请先修正表单错误' }],
                  },
                ],
              },
            },
          ],
        },
      },
      children: [
        {
          id: 'user-dialog-form',
          component: 'Form',
          props: {
            layout: 'vertical',
            initialValues: '{{state.currentRecord}}',
          },
          events: {
            onValuesChange: [
              { type: 'setState', key: 'currentRecord', value: '{{ { ...state.currentRecord, ...event[1] } }}' },
            ],
          },
          children: [
            {
              component: 'Form.Item',
              props: {
                name: 'name',
                label: '姓名',
                rules: [
                  { required: true, message: '请输入姓名' },
                  { min: 2, message: '姓名至少 2 个字符' },
                ],
              },
              children: [{ component: 'Input', props: { placeholder: '请输入姓名' } }],
            },
            {
              component: 'Form.Item',
              props: {
                name: 'email',
                label: '邮箱',
                rules: [
                  { required: true, message: '请输入邮箱' },
                  {
                    pattern: '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$',
                    message: '邮箱格式不正确',
                  },
                ],
              },
              children: [{ component: 'Input', props: { placeholder: '请输入邮箱' } }],
            },
            {
              component: 'Form.Item',
              props: {
                name: 'status',
                label: '状态',
                rules: [{ required: true, message: '请选择状态' }],
              },
              children: [
                {
                  component: 'Select',
                  props: {
                    options: [
                      { label: '启用', value: 'enabled' },
                      { label: '停用', value: 'disabled' },
                    ],
                  },
                },
              ],
            },
            {
              component: 'Form.Item',
              props: {
                name: 'role',
                label: '角色',
                rules: [{ required: true, message: '请选择角色' }],
              },
              children: [
                {
                  component: 'Select',
                  props: {
                    options: [
                      { label: '管理员', value: 'admin' },
                      { label: '运营', value: 'operator' },
                      { label: '访客', value: 'viewer' },
                    ],
                  },
                },
              ],
            },
            {
              component: 'Form.Item',
              if: '{{state.currentRecord?.role === "admin"}}',
              props: {
                name: 'permissionGroup',
                label: '权限组',
                rules: [{ required: true, message: '管理员必须填写权限组' }],
              },
              children: [{ component: 'Input', props: { placeholder: '例如：finance-admin' } }],
            },
          ],
        },
      ],
    },
  ],

  lifecycle: {
    onMount: [{ type: 'callMethod', name: 'fetchUsers' }],
  },
  body: {
    id: 'user-management-root',
    component: 'Container',
    props: { direction: 'column', gap: 16 },
    children: [
      {
        id: 'user-management-card',
        component: 'Card',
        props: {
          title: '用户管理',
        },
        children: [
          {
            id: 'search-form',
            component: 'Form',
            props: {
              layout: 'inline',
            },
            children: [
              {
                component: 'Form.Item',
                props: { label: '关键词' },
                children: [
                  {
                    component: 'Input',
                    props: {
                      placeholder: '搜索关键词...',
                      allowClear: true,
                      value: '{{state.keyword}}',
                    },
                    events: {
                      onChange: [{ type: 'setState', key: 'keyword', value: '{{event.target.value}}' }],
                    },
                  },
                ],
              },
              {
                component: 'Form.Item',
                props: { label: '状态' },
                children: [
                  {
                    component: 'Select',
                    props: {
                      placeholder: '选择状态',
                      style: { width: 140 },
                      value: '{{state.statusFilter}}',
                      options: [
                        { label: '全部', value: '' },
                        { label: '启用', value: 'enabled' },
                        { label: '停用', value: 'disabled' },
                      ],
                    },
                    events: {
                      onChange: [{ type: 'setState', key: 'statusFilter', value: '{{event}}' }],
                    },
                  },
                ],
              },
              {
                component: 'Form.Item',
                props: { label: '创建时间' },
                children: [
                  {
                    component: 'DatePicker.RangePicker',
                    props: {
                      value: '{{state.dateRange}}',
                    },
                    events: {
                      onChange: [{ type: 'setState', key: 'dateRange', value: '{{event[1]}}' }],
                    },
                  },
                ],
              },
              {
                component: 'Form.Item',
                children: [
                  {
                    component: 'Space',
                    children: [
                      {
                        component: 'Button',
                        props: { type: 'primary' },
                        children: '查询',
                        events: { onClick: [{ type: 'callMethod', name: 'fetchUsers' }] },
                      },
                      {
                        component: 'Button',
                        children: '重置',
                        events: {
                          onClick: [
                            { type: 'setState', key: 'keyword', value: '' },
                            { type: 'setState', key: 'statusFilter', value: '' },
                            { type: 'setState', key: 'dateRange', value: null },
                            { type: 'setState', key: 'pagination.current', value: 1 },
                            { type: 'setState', key: 'sorter.field', value: null },
                            { type: 'setState', key: 'sorter.order', value: null },
                            { type: 'callMethod', name: 'fetchUsers' },
                          ],
                        },
                      },
                      {
                        component: 'Button',
                        props: { type: 'dashed' },
                        children: '新增用户',
                        events: { onClick: [{ type: 'callMethod', name: 'openAddDialog' }] },
                      },
                    ],
                  },
                ],
              },
            ],
          },
          {
            component: 'Alert',
            if: '{{computed.selectedCount > 0}}',
            props: {
              type: 'info',
              showIcon: true,
              message: '{{"已选择 " + computed.selectedCount + " 项"}}',
            },
          },
          {
            component: 'Alert',
            props: {
              type: 'success',
              showIcon: true,
              message: '{{"当前页: " + state.pagination.current + "，总计: " + state.total + " 条"}}',
            },
          },
          {
            id: 'user-table',
            component: 'Table',
            props: {
              rowKey: 'id',
              bordered: true,
              dataSource: '{{state.userList}}',
              loading: '{{state.loading}}',
              pagination: {
                current: '{{state.pagination.current}}',
                pageSize: '{{state.pagination.pageSize}}',
                total: '{{state.total}}',
                showSizeChanger: true,
                showTotal: {
                  type: 'JSFunction',
                  params: ['total', 'range'],
                  body: 'return `${range[0]}-${range[1]} / ${total}`;',
                },
              },
              rowSelection: {
                selectedRowKeys: '{{state.selectedRowKeys}}',
              },
              editable: {
                editingKey: '{{state.editingRowId}}',
              },
            },
            events: {
              onChange: [
                { type: 'setState', key: 'pagination.current', value: '{{event[0]?.current ?? state.pagination.current}}' },
                { type: 'setState', key: 'pagination.pageSize', value: '{{event[0]?.pageSize ?? state.pagination.pageSize}}' },
                { type: 'setState', key: 'sorter.field', value: '{{event[2]?.field ?? null}}' },
                { type: 'setState', key: 'sorter.order', value: '{{event[2]?.order ?? null}}' },
                { type: 'callMethod', name: 'fetchUsers' },
              ],
              'rowSelection.onChange': [
                { type: 'setState', key: 'selectedRowKeys', value: '{{event[0] ?? event}}' },
              ],
            },
            columns: [
              { title: 'ID', dataIndex: 'id', width: 80, sorter: true },
              {
                title: '姓名',
                dataIndex: 'name',
                sorter: true,
                editRender: {
                  component: 'Input',
                  props: {
                    value: '{{state.editingData.name}}',
                  },
                  events: {
                    onChange: [{ type: 'setState', key: 'editingData.name', value: '{{event.target.value}}' }],
                  },
                },
              },
              {
                title: '邮箱',
                dataIndex: 'email',
                width: 220,
                editRender: {
                  component: 'Input',
                  props: {
                    value: '{{state.editingData.email}}',
                  },
                  events: {
                    onChange: [{ type: 'setState', key: 'editingData.email', value: '{{event.target.value}}' }],
                  },
                },
              },
              {
                title: '状态',
                dataIndex: 'status',
                render: {
                  component: 'Tag',
                  props: {
                    color: '{{text === "enabled" ? "green" : "default"}}',
                  },
                  children: '{{text === "enabled" ? "启用" : "停用"}}',
                },
                editRender: {
                  component: 'Select',
                  props: {
                    style: { width: 120 },
                    value: '{{state.editingData.status}}',
                    options: [
                      { label: '启用', value: 'enabled' },
                      { label: '停用', value: 'disabled' },
                    ],
                  },
                  events: {
                    onChange: [{ type: 'setState', key: 'editingData.status', value: '{{event}}' }],
                  },
                },
              },
              {
                title: '角色',
                dataIndex: 'role',
              },
              {
                title: '创建时间',
                dataIndex: 'createdAt',
                width: 200,
                sorter: true,
              },
              {
                title: '操作',
                key: 'actions',
                width: 260,
                render: {
                  component: 'Space',
                  children: [
                    {
                      component: 'Button',
                      if: '{{state.editingRowId !== record.id}}',
                      props: { size: 'small' },
                      children: '行编辑',
                      events: {
                        onClick: [
                          { type: 'setState', key: 'editingRowId', value: '{{record.id}}' },
                          { type: 'setState', key: 'editingData', value: '{{ { ...record } }}' },
                        ],
                      },
                    },
                    {
                      component: 'Button',
                      if: '{{state.editingRowId === record.id}}',
                      props: { size: 'small', type: 'primary' },
                      children: '保存',
                      events: {
                        onClick: [
                          {
                            type: 'fetch',
                            method: 'PUT',
                            url: '{{"/api/users/" + record.id}}',
                            data: '{{state.editingData}}',
                            onSuccess: [
                              { type: 'message', level: 'success', content: '行保存成功' },
                              { type: 'setState', key: 'editingRowId', value: null },
                              { type: 'setState', key: 'editingData', value: {} },
                              { type: 'callMethod', name: 'fetchUsers' },
                            ],
                            onError: [{ type: 'message', level: 'error', content: '行保存失败' }],
                          },
                        ],
                      },
                    },
                    {
                      component: 'Button',
                      if: '{{state.editingRowId === record.id}}',
                      props: { size: 'small' },
                      children: '取消',
                      events: {
                        onClick: [
                          { type: 'setState', key: 'editingRowId', value: null },
                          { type: 'setState', key: 'editingData', value: {} },
                        ],
                      },
                    },
                    {
                      component: 'Button',
                      if: '{{state.editingRowId !== record.id}}',
                      props: { size: 'small' },
                      children: '编辑',
                      events: {
                        onClick: [
                          {
                            type: 'callMethod',
                            name: 'openEditDialog',
                            params: { record: '{{record}}' },
                          },
                        ],
                      },
                    },
                    {
                      component: 'Popconfirm',
                      if: '{{state.editingRowId !== record.id}}',
                      props: { title: '确认删除该用户吗？' },
                      events: {
                        onConfirm: [
                          {
                            type: 'fetch',
                            method: 'DELETE',
                            url: '{{"/api/users/" + record.id}}',
                            onSuccess: [
                              { type: 'message', level: 'success', content: '删除成功' },
                              { type: 'callMethod', name: 'fetchUsers' },
                            ],
                            onError: [{ type: 'message', level: 'error', content: '删除失败' }],
                          },
                        ],
                      },
                      children: [
                        {
                          component: 'Button',
                          props: { size: 'small', danger: true },
                          children: '删除',
                        },
                      ],
                    },
                  ],
                },
              },
            ],
          },
        ],
      },
    ],
  },
};
