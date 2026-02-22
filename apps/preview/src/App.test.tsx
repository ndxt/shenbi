import { createElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from './App';

vi.mock('antd', async (importOriginal) => {
  const actual = await importOriginal<typeof import('antd')>();

  const Button = (props: any) =>
    createElement(
      'button',
      {
        onClick: props.onClick,
        type: props.htmlType ?? 'button',
        'data-loading': props.loading ? 'true' : 'false',
      },
      props.children,
    );

  const Input = (props: any) =>
    createElement('input', {
      placeholder: props.placeholder,
      value: props.value ?? '',
      onChange: props.onChange,
    });

  const Select = (props: any) =>
    createElement(
      'select',
      {
        'aria-label': props.placeholder ?? 'select',
        value: props.value ?? '',
        onChange: (event: any) => props.onChange?.(event.target.value),
      },
      [
        createElement(
          'option',
          {
            key: '__placeholder__',
            value: '',
          },
          props.placeholder ?? '',
        ),
        ...(props.options ?? []).map((option: any) =>
          createElement(
            'option',
            {
              key: String(option.value),
              value: option.value,
            },
            option.label,
          ),
        ),
      ],
    );

  const Card = (props: any) =>
    createElement('section', null, [
      createElement('header', { key: 'title' }, props.title),
      createElement('aside', { key: 'extra' }, props.extra),
      createElement('div', { key: 'body' }, props.children),
    ]);

  const Tag = (props: any) =>
    createElement(
      'span',
      { 'data-testid': 'tag', 'data-color': props.color ?? '' },
      props.children,
    );

  const Alert = (props: any) =>
    createElement('div', { role: 'alert' }, props.message ?? '');

  return {
    ...actual,
    Button,
    Input,
    Select,
    Card,
    Tag,
    Alert,
    message: {
      info: vi.fn(),
      success: vi.fn(),
      warning: vi.fn(),
      error: vi.fn(),
      loading: vi.fn(),
    },
    notification: {
      info: vi.fn(),
      success: vi.fn(),
      warning: vi.fn(),
      error: vi.fn(),
    },
    Modal: {
      confirm: vi.fn(),
    },
  };
});

describe('preview/App integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('渲染标题、slot 与 loop+if 结果', () => {
    render(createElement(App));

    expect(screen.getByText('Shenbi 低代码引擎 Demo')).toBeInTheDocument();
    expect(screen.getByText('更多')).toBeInTheDocument();
    expect(screen.getByText('React')).toBeInTheDocument();
    expect(screen.getByText('Vue')).toBeInTheDocument();
    expect(screen.getByText('Svelte')).toBeInTheDocument();
    expect(screen.queryByText('Angular')).toBeNull();
  });

  it('输入关键词后 Alert 文案会实时更新', async () => {
    const user = userEvent.setup();
    render(createElement(App));

    const input = screen.getByPlaceholderText('搜索关键词...');
    await user.type(input, 'abc');

    expect(screen.getByRole('alert')).toHaveTextContent('搜索: abc');
  });

  it('选择城市会更新 Select 值', async () => {
    const user = userEvent.setup();
    render(createElement(App));

    const select = screen.getByLabelText('选择城市') as HTMLSelectElement;
    await user.selectOptions(select, 'shanghai');

    expect(select.value).toBe('shanghai');
  });

  it('点击提交会触发 message.success 且按钮进入 loading', async () => {
    const user = userEvent.setup();
    render(createElement(App));

    const submitButton = screen.getByRole('button', { name: '提交' });
    await user.click(submitButton);

    await waitFor(async () => {
      const antd = await import('antd');
      expect(antd.message.success).toHaveBeenCalledWith('提交成功');
    });

    expect(screen.getByRole('button', { name: '提交' })).toHaveAttribute('data-loading', 'true');
  });
});
