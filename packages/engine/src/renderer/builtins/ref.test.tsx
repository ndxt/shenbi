import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { render, screen } from '@testing-library/react';
import { RefComponent } from './ref';

describe('RefComponent', () => {
  it('渲染 children 内容', () => {
    render(createElement(RefComponent, {}, '模板内容'));
    expect(screen.getByText('模板内容')).toBeTruthy();
  });

  it('无 children 时渲染为空', () => {
    const { container } = render(createElement(RefComponent));
    expect(container.innerHTML).toBe('');
  });

  it('接收 __templateId 属性不报错', () => {
    render(createElement(RefComponent, { __templateId: 'tpl_1' }, '引用内容'));
    expect(screen.getByText('引用内容')).toBeTruthy();
  });
});
