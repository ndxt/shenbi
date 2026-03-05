import {
  act,
  Children,
  cloneElement,
  createContext,
  createElement,
  isValidElement,
  useContext,
  useRef,
} from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from './App';

const { messageMock, notificationMock } = vi.hoisted(() => ({
  messageMock: {
    info: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
    loading: vi.fn(),
  },
  notificationMock: {
    info: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
  },
}));

interface FormContextValue {
  form: {
    setFieldsValue: (next: Record<string, any>) => void;
    getFieldsValue: () => Record<string, any>;
    validateFields: () => Promise<Record<string, any>>;
    resetFields: (fields?: string[]) => void;
  };
  onValuesChange?: (changed: Record<string, any>, all: Record<string, any>) => void;
}

function normalizeInputValue(eventOrValue: any): any {
  if (eventOrValue?.target) {
    return eventOrValue.target.value;
  }
  return eventOrValue;
}

function createMockFormStore() {
  let store: Record<string, any> = {};
  return {
    setFieldsValue(next: Record<string, any>) {
      store = { ...store, ...(next ?? {}) };
    },
    getFieldsValue() {
      return { ...store };
    },
    async validateFields() {
      if (!store.name || !store.email) {
        throw new Error('validation failed');
      }
      return { ...store };
    },
    resetFields(fields?: string[]) {
      if (!fields || fields.length === 0) {
        store = {};
        return;
      }
      store = { ...store };
      for (const field of fields) {
        delete store[field];
      }
    },
  };
}

vi.mock('antd', async (importOriginal) => {
  const actual = await importOriginal<typeof import('antd')>();
  const FormContext = createContext<FormContextValue | null>(null);

  const Button = (props: any) =>
    {
      const {
        children,
        onClick,
        htmlType,
        loading,
        className,
        style,
        'data-shenbi-node-id': nodeId,
      } = props;
      return createElement(
        'button',
        {
          onClick,
          type: htmlType ?? 'button',
          'data-loading': loading ? 'true' : 'false',
          ...(className ? { className } : {}),
          ...(style ? { style } : {}),
          ...(nodeId ? { 'data-shenbi-node-id': nodeId } : {}),
        },
        children,
      );
    };

  const Input = (props: any) =>
    {
      const {
        placeholder,
        value,
        onChange,
        className,
        style,
        'data-shenbi-node-id': nodeId,
      } = props;
      return createElement('input', {
        placeholder,
        value: value ?? '',
        onChange,
        ...(className ? { className } : {}),
        ...(style ? { style } : {}),
        ...(nodeId ? { 'data-shenbi-node-id': nodeId } : {}),
      });
    };

  const Select = (props: any) =>
    {
      const {
        placeholder,
        value,
        onChange,
        options,
        className,
        style,
        'data-shenbi-node-id': nodeId,
      } = props;
      return createElement(
        'select',
        {
          'aria-label': placeholder ?? 'select',
          value: value ?? '',
          onChange: (event: any) => onChange?.(event.target.value),
          ...(className ? { className } : {}),
          ...(style ? { style } : {}),
          ...(nodeId ? { 'data-shenbi-node-id': nodeId } : {}),
        },
        [
          createElement('option', { key: '__placeholder__', value: '' }, placeholder ?? ''),
          ...((options ?? []).map((option: any) =>
            createElement('option', { key: String(option.value), value: option.value }, option.label))),
        ],
      );
    };

  const RangePicker = (props: any) =>
    {
      const {
        value,
        onChange,
        className,
        style,
        'data-shenbi-node-id': nodeId,
      } = props;
      return createElement('input', {
        'aria-label': 'range-picker',
        value: Array.isArray(value) ? value.join(' ~ ') : '',
        onChange: (event: any) => {
          const next = event.target.value ? [event.target.value, event.target.value] : [];
          onChange?.(next, next);
        },
        ...(className ? { className } : {}),
        ...(style ? { style } : {}),
        ...(nodeId ? { 'data-shenbi-node-id': nodeId } : {}),
      });
    };

  const Form = (props: any) => {
    const form = props.form ?? createMockFormStore();
    return createElement(
      FormContext.Provider,
      { value: { form, onValuesChange: props.onValuesChange } },
      createElement('form', null, props.children),
    );
  };
  (Form as any).useForm = () => {
    const formRef = useRef<ReturnType<typeof createMockFormStore> | null>(null);
    if (!formRef.current) {
      formRef.current = createMockFormStore();
    }
    return [formRef.current];
  };

  const FormItem = (props: any) => {
    const ctx = useContext(FormContext);
    const name = props.name as string | undefined;
    let child = props.children;

    if (ctx && name) {
      const bindControl = (element: any) => {
        const currentValues = ctx.form.getFieldsValue();
        const originalOnChange = element.props?.onChange;
        return cloneElement(element, {
          value: currentValues[name] ?? element.props?.value ?? '',
          onChange: (event: any) => {
            const nextValue = normalizeInputValue(event);
            ctx.form.setFieldsValue({ [name]: nextValue });
            const allValues = ctx.form.getFieldsValue();
            ctx.onValuesChange?.({ [name]: nextValue }, allValues);
            originalOnChange?.(event);
          },
        });
      };

      if (isValidElement(child)) {
        child = bindControl(child as any);
      } else if (Array.isArray(child)) {
        child = child.map((item) => (isValidElement(item) ? bindControl(item as any) : item));
      }
    }

    return createElement(
      'div',
      null,
      props.label ? createElement('span', null, props.label) : null,
      child,
    );
  };
  (Form as any).Item = FormItem;

  const Card = (props: any) =>
    createElement('section', null, [
      createElement('header', { key: 'title' }, props.title),
      createElement('div', { key: 'body' }, props.children),
    ]);

  const Space = (props: any) => createElement('div', null, props.children);

  const Tag = (props: any) =>
    createElement('span', { 'data-testid': 'tag', 'data-color': props.color ?? '' }, props.children);

  const Alert = (props: any) =>
    createElement('div', { role: 'alert' }, props.title ?? '');

  const Popconfirm = (props: any) => {
    const childElement = Children.toArray(props.children).find((item) => isValidElement(item)) as any;
    if (!childElement) {
      return null;
    }
    const originalOnClick = childElement.props?.onClick;
    return cloneElement(childElement, {
      onClick: (event: any) => {
        props.onConfirm?.(event);
        originalOnClick?.(event);
      },
    });
  };

  const Modal = (props: any) => {
    if (!props.open) {
      return null;
    }
    return createElement('div', { role: 'dialog' }, [
      createElement('h2', { key: 'title' }, props.title),
      createElement('div', { key: 'content' }, props.children),
      createElement('div', { key: 'footer' }, props.footer),
    ]);
  };
  (Modal as any).confirm = vi.fn();
  (Modal as any).info = vi.fn();
  (Modal as any).success = vi.fn();
  (Modal as any).warning = vi.fn();
  (Modal as any).error = vi.fn();

  const resolveRowKey = (rowKey: any, record: Record<string, any>, index: number) => {
    if (typeof rowKey === 'function') {
      return rowKey(record, index);
    }
    if (typeof rowKey === 'string') {
      return record[rowKey];
    }
    return record.key ?? index;
  };

  const Table = (props: any) => {
    const rows = props.dataSource ?? [];
    const columns = props.columns ?? [];
    const nodeId = props['data-shenbi-node-id'];

    return createElement('div', nodeId ? { 'data-shenbi-node-id': nodeId } : null, [
      ...rows.map((record: Record<string, any>, index: number) =>
        createElement(
          'div',
          { key: resolveRowKey(props.rowKey, record, index) },
          columns.map((col: any, colIndex: number) =>
            createElement(
              'span',
              { key: `${col.key ?? col.dataIndex ?? colIndex}` },
              col.render
                ? col.render(record[col.dataIndex], record, index)
                : String(record[col.dataIndex] ?? ''),
            ),
          ),
        ),
      ),
      createElement(
        'button',
        {
          key: 'change',
          onClick: () => props.onChange?.(
            { current: 2, pageSize: props.pagination?.pageSize ?? 10 },
            {},
            { field: 'name', order: 'ascend' },
            {},
          ),
        },
        '触发表格变化',
      ),
      createElement(
        'button',
        {
          key: 'select',
          onClick: () => {
            const selectedKeys = rows.slice(0, 1).map((record: Record<string, any>, i: number) =>
              resolveRowKey(props.rowKey, record, i),
            );
            props.rowSelection?.onChange?.(selectedKeys, rows.slice(0, 1), {});
          },
        },
        '触发行选择',
      ),
    ]);
  };

  return {
    ...actual,
    Button,
    Input,
    Select,
    DatePicker: {
      RangePicker,
    },
    Form,
    Card,
    Space,
    Table,
    Tag,
    Alert,
    Popconfirm,
    Modal,
    message: messageMock,
    notification: notificationMock,
  };
});

describe('preview/App integration', () => {
  async function renderAppAndWaitFirstPage() {
    render(createElement(App));
    await waitFor(() => {
      expect(screen.getByText('User 1')).toBeInTheDocument();
    });
  }

  async function selectNodeInOutline(
    user: ReturnType<typeof userEvent.setup>,
    nodeName: string,
  ) {
    await user.click(screen.getByText('Outline'));
    await user.click(screen.getByText(nodeName));
  }

  async function selectCardNodeInOutline(user: ReturnType<typeof userEvent.setup>) {
    await selectNodeInOutline(user, 'user-management-card (Card)');
    await waitFor(() => {
      expect(screen.getByLabelText('title')).toBeInTheDocument();
    });
  }

  beforeEach(() => {
    vi.clearAllMocks();
    window.history.replaceState(null, '', '/');
    window.localStorage.clear();
  });

  it('首屏渲染用户管理并自动拉取用户列表', async () => {
    await renderAppAndWaitFirstPage();
    expect(screen.getByText('用户管理')).toBeInTheDocument();
  });

  it('查询关键词后可刷新列表', async () => {
    const user = userEvent.setup();
    await renderAppAndWaitFirstPage();

    const input = screen.getByPlaceholderText('搜索关键词...');
    await user.clear(input);
    await user.type(input, 'User 2');
    await user.click(screen.getByRole('button', { name: '查询' }));

    await waitFor(() => {
      expect(screen.getByText('User 2')).toBeInTheDocument();
    });
  });

  it('表格 onChange 会更新分页状态并反映到页面', async () => {
    const user = userEvent.setup();
    await renderAppAndWaitFirstPage();

    await user.click(screen.getByRole('button', { name: '触发表格变化' }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('当前页: 2');
    });
  });

  it('点击新增用户可打开弹窗并取消关闭', async () => {
    const user = userEvent.setup();
    await renderAppAndWaitFirstPage();

    await user.click(screen.getByRole('button', { name: '新增用户' }));
    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByText('新增用户')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '取消' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
  });

  it('行选择会更新已选提示', async () => {
    const user = userEvent.setup();
    await renderAppAndWaitFirstPage();

    await user.click(screen.getByRole('button', { name: '触发行选择' }));

    await waitFor(() => {
      const alerts = screen.getAllByRole('alert');
      expect(alerts.some((alert) => alert.textContent?.includes('已选择 1 项'))).toBe(true);
    });
  });

  it('状态筛选会同步 URL 并过滤列表', async () => {
    const user = userEvent.setup();
    await renderAppAndWaitFirstPage();

    const statusSelect = screen.getByLabelText('选择状态');
    await user.selectOptions(statusSelect, 'disabled');

    await waitFor(() => {
      const params = new URLSearchParams(window.location.search);
      expect(params.get('status')).toBe('disabled');
    });
    await waitFor(() => {
      expect(screen.queryByText('User 1')).toBeNull();
      expect(screen.getByText('User 2')).toBeInTheDocument();
    });
  });

  it('重置可清空筛选并回到第 1 页', async () => {
    const user = userEvent.setup();
    await renderAppAndWaitFirstPage();

    const input = screen.getByPlaceholderText('搜索关键词...');
    await user.clear(input);
    await user.type(input, 'User 20');
    await user.click(screen.getByRole('button', { name: '查询' }));

    await waitFor(() => {
      expect(screen.getByText('User 20')).toBeInTheDocument();
    });
    // 等待 keyword watcher 的 debounce 落稳，避免与分页变更断言产生竞态。
    await act(async () => {
      await new Promise((resolve) => {
        setTimeout(resolve, 350);
      });
    });

    await user.click(screen.getByRole('button', { name: '触发表格变化' }));
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('当前页: 2');
    });

    await user.click(screen.getByRole('button', { name: '重置' }));

    await waitFor(() => {
      expect(screen.getByText('User 1')).toBeInTheDocument();
      expect(screen.getByRole('alert')).toHaveTextContent('当前页: 1');
    });
  });

  it('syncToUrl: 关键词与分页状态会同步到 URL', async () => {
    const user = userEvent.setup();
    await renderAppAndWaitFirstPage();

    const input = screen.getByPlaceholderText('搜索关键词...');
    await user.clear(input);
    await user.type(input, 'User 3');

    await waitFor(() => {
      const params = new URLSearchParams(window.location.search);
      expect(params.get('keyword')).toBe('User 3');
    });

    await user.click(screen.getByRole('button', { name: '触发表格变化' }));
    await waitFor(() => {
      const params = new URLSearchParams(window.location.search);
      expect(params.get('page')).toBe('2');
    });
  });

  it('syncToUrl: 首次加载会从 URL 恢复查询条件', async () => {
    window.history.replaceState(null, '', '/?keyword=User+2&page=1');
    render(createElement(App));

    const input = screen.getByPlaceholderText('搜索关键词...') as HTMLInputElement;
    await waitFor(() => {
      expect(input.value).toBe('User 2');
    });
    await waitFor(() => {
      expect(screen.getByText('User 2')).toBeInTheDocument();
    });
  });

  it('编辑器：选中节点后右侧按契约展示属性', async () => {
    const user = userEvent.setup();
    await renderAppAndWaitFirstPage();

    await selectCardNodeInOutline(user);

    expect(screen.getByText('契约属性')).toBeInTheDocument();
    expect(screen.getByLabelText('title')).toHaveValue('用户管理');
  });

  it('编辑器：修改 props 会回写场景并刷新渲染', async () => {
    const user = userEvent.setup();
    await renderAppAndWaitFirstPage();

    await selectCardNodeInOutline(user);

    const titleInput = screen.getByLabelText('title');
    await user.clear(titleInput);
    await user.type(titleInput, '用户管理-测试改名');
    await user.tab();

    await waitFor(() => {
      expect(screen.getByText('用户管理-测试改名')).toBeInTheDocument();
    });
  });

  it('编辑器：切换场景后状态隔离，不串改动', async () => {
    const user = userEvent.setup();
    await renderAppAndWaitFirstPage();

    await selectCardNodeInOutline(user);

    const titleInput = screen.getByLabelText('title');
    await user.clear(titleInput);
    await user.type(titleInput, '用户管理-隔离验证');
    await user.tab();

    await waitFor(() => {
      expect(screen.getByText('用户管理-隔离验证')).toBeInTheDocument();
    });

    const scenarioSelect = screen.getByLabelText('场景切换');
    await user.selectOptions(scenarioSelect, 'form-list');
    await waitFor(() => {
      expect(screen.queryByText('用户管理-隔离验证')).toBeNull();
    });

    await user.selectOptions(scenarioSelect, 'user-management');
    await waitFor(() => {
      expect(screen.getByText('用户管理-隔离验证')).toBeInTheDocument();
    });
  });

  it('编辑器：可手动切换 shell mode 与多场景模式', async () => {
    const user = userEvent.setup();
    await renderAppAndWaitFirstPage();

    const modeSelect = screen.getByLabelText('模式切换');
    expect(screen.getByLabelText('场景切换')).toBeInTheDocument();

    await user.selectOptions(modeSelect, 'shell');
    await waitFor(() => {
      expect(screen.queryByLabelText('场景切换')).toBeNull();
    });
    await waitFor(() => {
      expect(screen.queryByText('User 1')).toBeNull();
    });

    await user.selectOptions(modeSelect, 'scenarios');
    await waitFor(() => {
      expect(screen.getByLabelText('场景切换')).toBeInTheDocument();
      expect(screen.getByText('User 1')).toBeInTheDocument();
    });
  });

  it('编辑器：Sidebar 支持插件扩展 Tab（Assets）', async () => {
    const user = userEvent.setup();
    await renderAppAndWaitFirstPage();

    await user.click(screen.getByText('Assets'));
    await waitFor(() => {
      expect(screen.getByText('Sidebar Plugin Loaded')).toBeInTheDocument();
    });
  });

  it('编辑器：Shell 模式 Files 面板支持另存并打开', async () => {
    const user = userEvent.setup();
    const promptSpy = vi.spyOn(window, 'prompt').mockReturnValue('Shell Demo');
    await renderAppAndWaitFirstPage();

    const modeSelect = screen.getByLabelText('模式切换');
    await user.selectOptions(modeSelect, 'shell');

    await waitFor(() => {
      expect(screen.queryByText('User 1')).toBeNull();
    });

    await user.click(screen.getByText('Files'));
    await user.click(screen.getByRole('button', { name: '另存为' }));

    await waitFor(() => {
      expect(screen.getByText('Shell Demo')).toBeInTheDocument();
      expect(screen.getByText(/已保存:/)).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: '打开' }));
    await waitFor(() => {
      expect(screen.getByText(/已打开:/)).toBeInTheDocument();
    });

    promptSpy.mockRestore();
  });

  it('编辑器：ActivityBar 支持插件扩展图标（Rocket）', async () => {
    const user = userEvent.setup();
    await renderAppAndWaitFirstPage();

    await user.click(screen.getByLabelText('Rocket'));
    await waitFor(() => {
      expect(screen.getByText('Activity Plugin Triggered')).toBeInTheDocument();
      expect(screen.getByText('Sidebar Plugin Loaded')).toBeInTheDocument();
    });
  });

  it('编辑器：Inspector 支持插件扩展 Tab（Debug）', async () => {
    const user = userEvent.setup();
    await renderAppAndWaitFirstPage();

    const debugCandidates = screen.getAllByText('Debug');
    const inspectorDebugTab = debugCandidates.at(-1);
    if (!inspectorDebugTab) {
      throw new Error('Inspector Debug tab not found');
    }
    await user.click(inspectorDebugTab);
    await waitFor(() => {
      expect(screen.getByText('Plugin Tab Loaded')).toBeInTheDocument();
    });
  });

  it('AI 面板：通过 bridge 执行 schema.replace 并更新画布', async () => {
    const user = userEvent.setup();
    await renderAppAndWaitFirstPage();

    await user.click(screen.getByTitle('Toggle AI Assistant'));
    const generateButton = await screen.findByRole('button', { name: '生成演示页面' });
    await user.click(generateButton);

    await waitFor(() => {
      expect(screen.getByText('AI 生成演示页面')).toBeInTheDocument();
      expect(screen.getByText('开始使用')).toBeInTheDocument();
      expect(screen.getByText('状态：已应用 AI 演示页面')).toBeInTheDocument();
    });
  });

  it('编辑器：Events 支持 JSON 回写并驱动运行时', async () => {
    const user = userEvent.setup();
    await renderAppAndWaitFirstPage();

    await user.click(screen.getByRole('button', { name: '查询' }));
    await user.click(screen.getByText('Events'));

    const actionsEditor = await screen.findByLabelText('onClick actions');
    fireEvent.change(actionsEditor, {
      target: {
        value: JSON.stringify(
          [
            { type: 'setState', key: 'keyword', value: 'User 3' },
            { type: 'callMethod', name: 'fetchUsers' },
          ],
          null,
          2,
        ),
      },
    });
    fireEvent.blur(actionsEditor);

    const input = screen.getByPlaceholderText('搜索关键词...') as HTMLInputElement;
    await user.clear(input);
    await user.type(input, 'User 1');
    await user.click(screen.getByRole('button', { name: '查询' }));

    await waitFor(() => {
      expect(input.value).toBe('User 3');
      expect(screen.getByText('User 3')).toBeInTheDocument();
    });
  });

  it('编辑器：Input onChange 事件支持回写', async () => {
    const user = userEvent.setup();
    await renderAppAndWaitFirstPage();

    await selectNodeInOutline(user, 'search-keyword-input (Input)');
    await user.click(screen.getByText('Events'));

    const actionsEditor = await screen.findByLabelText('onChange actions');
    fireEvent.change(actionsEditor, {
      target: {
        value: JSON.stringify(
          [{ type: 'setState', key: 'keyword', value: 'User 9' }],
          null,
          2,
        ),
      },
    });
    fireEvent.blur(actionsEditor);

    const input = screen.getByPlaceholderText('搜索关键词...') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'anything' } });

    await waitFor(() => {
      expect(input.value).toBe('User 9');
      expect(screen.getByText('User 9')).toBeInTheDocument();
    });
  });

  it('编辑器：Table onChange 事件支持回写', async () => {
    const user = userEvent.setup();
    await renderAppAndWaitFirstPage();

    await selectNodeInOutline(user, 'user-table (Table)');
    await user.click(screen.getByText('Events'));

    const actionsEditor = await screen.findByLabelText('onChange actions');
    fireEvent.change(actionsEditor, {
      target: {
        value: JSON.stringify(
          [{ type: 'setState', key: 'pagination.current', value: 5 }],
          null,
          2,
        ),
      },
    });
    fireEvent.blur(actionsEditor);

    await user.click(screen.getByRole('button', { name: '触发表格变化' }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('当前页: 5');
    });
  });

  it('编辑器：Style 支持 JSON 回写', async () => {
    const user = userEvent.setup();
    await renderAppAndWaitFirstPage();

    await selectNodeInOutline(user, 'search-submit-btn (Button)');
    await user.click(screen.getByText('Style'));

    const styleEditor = await screen.findByLabelText('style json');
    fireEvent.change(styleEditor, {
      target: {
        value: JSON.stringify({ display: 'none' }, null, 2),
      },
    });
    fireEvent.blur(styleEditor);

    await waitFor(() => {
      const submitButton = document.querySelector('[data-shenbi-node-id="search-submit-btn"]') as HTMLButtonElement | null;
      if (!submitButton) {
        throw new Error('search-submit-btn not found');
      }
      expect(submitButton.style.display).toBe('none');
    });
  });

  it('编辑器：Logic 支持 JSON 回写', async () => {
    const user = userEvent.setup();
    await renderAppAndWaitFirstPage();

    await selectNodeInOutline(user, 'search-submit-btn (Button)');
    await user.click(screen.getByText('Logic'));

    const logicEditor = await screen.findByLabelText('logic json');
    fireEvent.change(logicEditor, {
      target: {
        value: JSON.stringify({ if: '{{false}}' }, null, 2),
      },
    });
    fireEvent.blur(logicEditor);

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: '查询' })).toBeNull();
    });
  });
});
