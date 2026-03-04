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
});
