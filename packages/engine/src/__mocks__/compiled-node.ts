import type { CompiledNode } from '../types/contracts';
import { createCompiledExpr as expr } from '../utils/create-compiled-expr';

export const mockCompiledButtonNode: CompiledNode = {
  id: 'btn_submit',
  Component: 'button',
  componentType: 'Button',
  staticProps: {
    type: 'primary'
  },
  dynamicProps: {
    disabled: expr('{{state.loading}}', (ctx) => Boolean(ctx.state.loading), ['state.loading'])
  },
  childrenFn: expr('{{state.submitText}}', (ctx) => ctx.state.submitText ?? 'Submit', [
    'state.submitText'
  ]),
  events: {
    onClick: [{ type: 'callMethod', name: 'handleSubmit' }]
  },
  allDeps: ['state.loading', 'state.submitText']
};

export const mockCompiledLoopNode: CompiledNode = {
  id: 'tag_loop',
  Component: 'div',
  componentType: 'Tag',
  staticProps: {},
  dynamicProps: {},
  loop: {
    dataFn: expr('{{state.tags}}', (ctx) => ctx.state.tags ?? [], ['state.tags']),
    itemKey: 'item',
    indexKey: 'index',
    keyFn: expr('{{item.id ?? index}}', (ctx) => ctx.item?.id ?? ctx.index, []),
    body: {
      Component: 'span',
      componentType: 'Tag',
      staticProps: {},
      dynamicProps: {
        color: expr('{{item.color}}', (ctx) => ctx.item?.color ?? 'default')
      },
      childrenFn: expr('{{item.label}}', (ctx) => ctx.item?.label ?? ''),
      allDeps: []
    }
  },
  allDeps: ['state.tags']
};
