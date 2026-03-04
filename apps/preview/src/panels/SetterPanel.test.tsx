import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { SchemaNode } from '@shenbi/schema';
import { buttonContract, tableContract } from '@shenbi/schema';
import { SetterPanel } from './SetterPanel';

describe('SetterPanel/Props contract-driven controls', () => {
  it('boolean 属性使用 checkbox 并回写布尔值', () => {
    const onPatchProps = vi.fn();
    const selectedNode: SchemaNode = {
      id: 'btn-1',
      component: 'Button',
      props: { disabled: false },
      children: '提交',
    };

    render(
      <SetterPanel
        selectedNode={selectedNode}
        contract={buttonContract}
        onPatchProps={onPatchProps}
        activeTab="props"
      />,
    );

    const checkbox = screen.getByLabelText('disabled') as HTMLInputElement;
    expect(checkbox.type).toBe('checkbox');
    expect(checkbox.checked).toBe(false);

    fireEvent.click(checkbox);
    expect(onPatchProps).toHaveBeenCalledWith({ disabled: true });
  });

  it('enum 属性使用 select 并回写枚举值', () => {
    const onPatchProps = vi.fn();
    const selectedNode: SchemaNode = {
      id: 'btn-2',
      component: 'Button',
      props: { type: 'default' },
      children: '提交',
    };

    render(
      <SetterPanel
        selectedNode={selectedNode}
        contract={buttonContract}
        onPatchProps={onPatchProps}
        activeTab="props"
      />,
    );

    const typeSelect = screen.getByLabelText('type') as HTMLSelectElement;
    fireEvent.change(typeSelect, { target: { value: 'link' } });

    expect(onPatchProps).toHaveBeenCalledWith({ type: 'link' });
  });

  it('object 属性使用 JSON textarea，非法 JSON 不回写', () => {
    const onPatchProps = vi.fn();
    const selectedNode: SchemaNode = {
      id: 'table-1',
      component: 'Table',
      props: { pagination: { current: 1, pageSize: 10 } },
    };

    render(
      <SetterPanel
        selectedNode={selectedNode}
        contract={tableContract}
        onPatchProps={onPatchProps}
        activeTab="props"
      />,
    );

    const editor = screen.getByLabelText('pagination');
    fireEvent.change(editor, { target: { value: '{' } });
    fireEvent.blur(editor);

    expect(onPatchProps).not.toHaveBeenCalled();
    expect(screen.getByText('属性值必须是对象 JSON')).toBeInTheDocument();
  });

  it('allowExpression 的 boolean 遇到表达式时降级为文本输入', () => {
    const selectedNode: SchemaNode = {
      id: 'btn-3',
      component: 'Button',
      props: { disabled: '{{state.locked}}' },
      children: '提交',
    };

    render(
      <SetterPanel
        selectedNode={selectedNode}
        contract={buttonContract}
        activeTab="props"
      />,
    );

    const input = screen.getByLabelText('disabled') as HTMLInputElement;
    expect(input.type).toBe('text');
    expect(input.value).toBe('{{state.locked}}');
  });

  it('Props 按基础属性与结构属性分组展示', () => {
    const selectedNode: SchemaNode = {
      id: 'table-2',
      component: 'Table',
      props: {
        bordered: true,
        pagination: { current: 1, pageSize: 10 },
      },
    };

    render(
      <SetterPanel
        selectedNode={selectedNode}
        contract={tableContract}
        activeTab="props"
      />,
    );

    expect(screen.getByText('基础属性')).toBeInTheDocument();
    expect(screen.getByText('结构属性')).toBeInTheDocument();
  });

  it('高级属性 JSON 视图可回写 props patch', () => {
    const onPatchProps = vi.fn();
    const selectedNode: SchemaNode = {
      id: 'btn-4',
      component: 'Button',
      props: { type: 'default' },
      children: '提交',
    };

    render(
      <SetterPanel
        selectedNode={selectedNode}
        contract={buttonContract}
        onPatchProps={onPatchProps}
        activeTab="props"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '打开 JSON 视图' }));
    const editor = screen.getByLabelText('props json');
    fireEvent.change(editor, {
      target: {
        value: JSON.stringify({ type: 'primary', loading: true }),
      },
    });
    fireEvent.blur(editor);

    expect(onPatchProps).toHaveBeenCalledWith({ type: 'primary', loading: true });
  });

  it('高级属性 JSON 非对象时提示错误且不回写', () => {
    const onPatchProps = vi.fn();
    const selectedNode: SchemaNode = {
      id: 'btn-5',
      component: 'Button',
      props: { type: 'default' },
      children: '提交',
    };

    render(
      <SetterPanel
        selectedNode={selectedNode}
        contract={buttonContract}
        onPatchProps={onPatchProps}
        activeTab="props"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '打开 JSON 视图' }));
    const editor = screen.getByLabelText('props json');
    fireEvent.change(editor, { target: { value: '[]' } });
    fireEvent.blur(editor);

    expect(onPatchProps).not.toHaveBeenCalled();
    expect(screen.getByText('props 必须是对象 JSON')).toBeInTheDocument();
  });

  it('Table.columns 可视化编辑会回写 onPatchColumns', () => {
    const onPatchColumns = vi.fn();
    const selectedNode: SchemaNode = {
      id: 'table-3',
      component: 'Table',
      columns: [
        { title: '姓名', dataIndex: 'name' },
      ],
    };

    render(
      <SetterPanel
        selectedNode={selectedNode}
        contract={tableContract}
        onPatchColumns={onPatchColumns}
        activeTab="props"
      />,
    );

    const titleInput = screen.getByLabelText('列1 标题');
    fireEvent.change(titleInput, { target: { value: '用户名' } });

    expect(onPatchColumns).toHaveBeenCalled();
    const lastCall = onPatchColumns.mock.calls.at(-1)?.[0] as Array<Record<string, unknown>>;
    expect(lastCall[0]?.title).toBe('用户名');
  });

  it('Table props JSON 中的 columns 会拆分为 onPatchColumns 回写', () => {
    const onPatchProps = vi.fn();
    const onPatchColumns = vi.fn();
    const selectedNode: SchemaNode = {
      id: 'table-4',
      component: 'Table',
      props: { bordered: true },
      columns: [{ title: '姓名', dataIndex: 'name' }],
    };

    render(
      <SetterPanel
        selectedNode={selectedNode}
        contract={tableContract}
        onPatchProps={onPatchProps}
        onPatchColumns={onPatchColumns}
        activeTab="props"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '打开 JSON 视图' }));
    const editor = screen.getByLabelText('props json');
    fireEvent.change(editor, {
      target: {
        value: JSON.stringify({
          bordered: false,
          columns: [{ title: '邮箱', dataIndex: 'email' }],
        }),
      },
    });
    fireEvent.blur(editor);

    expect(onPatchColumns).toHaveBeenCalledWith([{ title: '邮箱', dataIndex: 'email' }]);
    expect(onPatchProps).toHaveBeenCalledWith({ bordered: false });
  });
});
