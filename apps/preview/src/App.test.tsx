import {
  Children,
  cloneElement,
  createContext,
  createElement,
  isValidElement,
  useContext,
  useRef,
} from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from './App';
import { MockAIClient, resetAIClient, setAIClient } from '@shenbi/editor-plugin-ai-chat';

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

const fetchMock = vi.hoisted(() => vi.fn());

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
  const Row = (props: any) => createElement('div', null, props.children);
  const Col = (props: any) => createElement('div', null, props.children);
  const Typography = {
    Title: (props: any) => createElement('h1', null, props.children),
    Text: (props: any) => createElement('span', null, props.children),
    Paragraph: (props: any) => createElement('p', null, props.children),
  };

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
    Row,
    Col,
    Typography,
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
  function clearShellModeFlag() {
    delete (window as unknown as Record<string, unknown>).__SHENBI_SHELL_MODE__;
  }

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
    clearShellModeFlag();
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: [
          { id: 'GLM-4.7', name: 'GLM-4.7' },
          { id: 'GLM-4.6', name: 'GLM-4.6' },
        ],
      }),
    } satisfies Partial<Response>);
    vi.stubGlobal('fetch', fetchMock);
    setAIClient(new MockAIClient());
  });

  afterEach(() => {
    resetAIClient();
    vi.unstubAllGlobals();
    clearShellModeFlag();
  });

  it('首屏渲染用户管理并自动拉取用户列表', async () => {
    await renderAppAndWaitFirstPage();
    expect(screen.getByText('用户管理', { selector: 'header' })).toBeInTheDocument();
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

  it('AI 面板：面板开关和模型选择可从本地恢复', async () => {
    const user = userEvent.setup();
    const firstRender = render(createElement(App));

    await waitFor(() => {
      expect(screen.getByText('User 1')).toBeInTheDocument();
    });

    await user.click(screen.getByTitle('Toggle AI Assistant'));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '清空' })).toBeInTheDocument();
    });

    await user.selectOptions(screen.getByLabelText('Planner'), 'GLM-4.6');
    await user.selectOptions(screen.getByLabelText('Block'), 'GLM-4.6');

    firstRender.unmount();

    render(createElement(App));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '清空' })).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(screen.getByLabelText('Planner')).toHaveValue('GLM-4.6');
      expect(screen.getByLabelText('Block')).toHaveValue('GLM-4.6');
    });
  });

  it('AI 面板：常用覆盖场景和历史输入可回填到输入框', async () => {
    const user = userEvent.setup();
    await renderAppAndWaitFirstPage();

    await user.selectOptions(screen.getByLabelText('模式切换'), 'shell');
    await user.click(screen.getByTitle('Toggle AI Assistant'));

    const input = await screen.findByPlaceholderText('输入调试提示词，Enter 发送，Shift+Enter 换行');
    await user.click(screen.getByRole('button', { name: '常用覆盖场景' }));
    await user.click(screen.getByRole('button', { name: '工作台总览' }));
    expect(input).toHaveValue('生成一个复杂工作台首页，包含筛选区、指标卡、趋势图、表格列表、右侧详情抽屉和顶部快捷操作，重点覆盖卡片、表格、Tabs、Drawer、Form、按钮和响应式布局组合。');

    await user.type(input, '{enter}');

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '清空' })).toBeEnabled();
    }, { timeout: 9000 });

    await user.click(screen.getByRole('button', { name: '历史输入' }));
    await user.click(screen.getByRole('button', { name: /生成一个复杂工作台首页/ }));
    await waitFor(() => {
      expect(input).toHaveValue('生成一个复杂工作台首页，包含筛选区、指标卡、趋势图、表格列表、右侧详情抽屉和顶部快捷操作，重点覆盖卡片、表格、Tabs、Drawer、Form、按钮和响应式布局组合。');
    });
  }, 12000);

  it('AI 面板：通过 skeleton 热替换并更新画布', async () => {
    const user = userEvent.setup();
    await renderAppAndWaitFirstPage();

    await user.selectOptions(screen.getByLabelText('模式切换'), 'shell');
    await waitFor(() => {
      expect(screen.queryByLabelText('场景切换')).toBeNull();
    });

    await user.click(screen.getByTitle('Toggle AI Assistant'));
    const input = await screen.findByPlaceholderText('输入调试提示词，Enter 发送，Shift+Enter 换行');
    await user.type(input, '生成演示页面{enter}');

    await waitFor(() => {
      expect(screen.getByText('页面头部', { selector: 'header' })).toBeInTheDocument();
      expect(screen.getByText('欢迎使用 Plan B 布局生成')).toBeInTheDocument();
      expect(screen.getByText('右侧说明区', { selector: 'header' })).toBeInTheDocument();
    }, { timeout: 9000 });
  }, 12000);

  it('AI 面板：清空会重置聊天记录', async () => {
    const user = userEvent.setup();
    await renderAppAndWaitFirstPage();

    await user.selectOptions(screen.getByLabelText('模式切换'), 'shell');
    await user.click(screen.getByTitle('Toggle AI Assistant'));
    const input = await screen.findByPlaceholderText('输入调试提示词，Enter 发送，Shift+Enter 换行');
    await user.type(input, '生成演示页面{enter}');

    await waitFor(() => {
      expect(screen.getByText('页面头部', { selector: 'header' })).toBeInTheDocument();
      expect(screen.getByText('右侧说明区', { selector: 'header' })).toBeInTheDocument();
    }, { timeout: 9000 });

    await user.click(screen.getByRole('button', { name: '清空' }));

    await waitFor(() => {
      expect(screen.queryByText('生成完成')).toBeNull();
      expect(screen.queryByText('欢迎使用 Plan B 布局生成')).toBeNull();
    });
  }, 12000);

  it('工具栏：清空页面会重置当前画布', async () => {
    const user = userEvent.setup();
    await renderAppAndWaitFirstPage();

    await user.selectOptions(screen.getByLabelText('模式切换'), 'shell');
    await user.click(screen.getByTitle('Toggle AI Assistant'));
    const input = await screen.findByPlaceholderText('输入调试提示词，Enter 发送，Shift+Enter 换行');
    await user.type(input, '生成演示页面{enter}');

    await waitFor(() => {
      expect(screen.getByText('页面头部', { selector: 'header' })).toBeInTheDocument();
    }, { timeout: 9000 });

    await user.click(screen.getByRole('button', { name: '清空页面' }));

    await waitFor(() => {
      expect(screen.queryByText('页面头部', { selector: 'header' })).toBeNull();
      expect(screen.queryByText('欢迎使用 Plan B 布局生成')).toBeNull();
    });
  }, 12000);

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
});
