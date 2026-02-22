import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { render, screen } from '@testing-library/react';
import type { CompiledNode } from '../types/contracts';
import { ShenbiPage } from './shenbi-page';
import { createMockRuntime } from '../__mocks__/runtime';
import { createMockResolver } from '../__mocks__/resolver';
import { mockPageSchema } from '../__mocks__/page-schema';
import { expr } from '../test-utils';

function makeSimpleBody(text: string): CompiledNode {
  return {
    Component: 'div',
    componentType: 'Container',
    staticProps: { 'data-testid': 'body' },
    dynamicProps: {},
    childrenFn: expr(text, () => text),
    allDeps: [],
  };
}

function renderPage(
  overrides: {
    state?: Record<string, any>;
    compiledBody?: CompiledNode | CompiledNode[];
    compiledDialogs?: CompiledNode[];
  } = {},
) {
  const runtime = createMockRuntime(overrides.state);
  const resolver = createMockResolver();
  const pageProps = {
    schema: mockPageSchema,
    resolver,
    runtime,
    compiledBody: overrides.compiledBody ?? makeSimpleBody('默认内容'),
  };

  if (overrides.compiledDialogs) {
    Object.assign(pageProps, { compiledDialogs: overrides.compiledDialogs });
  }

  return render(
    createElement(ShenbiPage, pageProps),
  );
}

describe('ShenbiPage', () => {
  it('渲染 compiledBody 内容', () => {
    renderPage({ compiledBody: makeSimpleBody('页面内容') });
    expect(screen.getByText('页面内容')).toBeTruthy();
  });

  it('支持 compiledBody 为数组', () => {
    renderPage({
      compiledBody: [
        { ...makeSimpleBody('节点A'), id: 'a' },
        { ...makeSimpleBody('节点B'), id: 'b' },
      ],
    });
    expect(screen.getByText('节点A')).toBeTruthy();
    expect(screen.getByText('节点B')).toBeTruthy();
  });

  it('dialog 未打开时不渲染', () => {
    const dialog: CompiledNode = {
      id: 'dlg1',
      Component: 'div',
      componentType: 'Modal',
      staticProps: {},
      dynamicProps: {},
      childrenFn: expr('弹窗内容', () => '弹窗内容'),
      allDeps: [],
    };
    renderPage({
      state: { __dialog_dlg1: false },
      compiledBody: makeSimpleBody('主体'),
      compiledDialogs: [dialog],
    });
    expect(screen.getByText('主体')).toBeTruthy();
    expect(screen.queryByText('弹窗内容')).toBeNull();
  });

  it('dialog 打开时渲染弹窗内容', () => {
    const dialog: CompiledNode = {
      id: 'dlg1',
      Component: 'div',
      componentType: 'Modal',
      staticProps: {},
      dynamicProps: {},
      childrenFn: expr('弹窗内容', () => '弹窗内容'),
      allDeps: [],
    };
    renderPage({
      state: { __dialog_dlg1: true },
      compiledBody: makeSimpleBody('主体'),
      compiledDialogs: [dialog],
    });
    expect(screen.getByText('主体')).toBeTruthy();
    expect(screen.getByText('弹窗内容')).toBeTruthy();
  });

  it('Context 正确注入: 子组件可访问 runtime', () => {
    const body: CompiledNode = {
      Component: 'span',
      componentType: 'Text',
      staticProps: {},
      dynamicProps: {},
      childrenFn: expr('{{state.msg}}', (ctx) => ctx.state.msg),
      allDeps: ['state.msg'],
    };
    renderPage({ state: { msg: '来自运行时' }, compiledBody: body });
    expect(screen.getByText('来自运行时')).toBeTruthy();
  });
});
