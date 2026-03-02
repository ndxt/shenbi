import type { CompiledNode } from '@shenbi/engine';
import { createCompiledExpr as expr } from '@shenbi/engine';

/**
 * 预编译的 Demo 节点树。
 * 在 Worker A 的 compiler 完成前，手动构建 CompiledNode 供 preview 使用。
 */
// --- Input (场景 2) ---
const inputNode: CompiledNode = {
  id: 'search_input',
  Component: null, // resolved by resolver
  componentType: 'Input',
  staticProps: { placeholder: '搜索关键词...', allowClear: true },
  dynamicProps: {
    value: expr('{{state.keyword}}', (ctx) => ctx.state.keyword, ['state.keyword']),
  },
  events: {
    onChange: [
      { type: 'setState', key: 'keyword', value: '{{event.target.value}}' },
    ],
  },
  allDeps: ['state.keyword'],
};

// --- Select (场景 3) ---
const selectNode: CompiledNode = {
  id: 'city_select',
  Component: null,
  componentType: 'Select',
  staticProps: {
    placeholder: '选择城市',
    style: { width: 200 },
    options: [
      { label: '北京', value: 'beijing' },
      { label: '上海', value: 'shanghai' },
      { label: '广州', value: 'guangzhou' },
    ],
  },
  dynamicProps: {
    value: expr('{{state.selectedCity}}', (ctx) => ctx.state.selectedCity, ['state.selectedCity']),
  },
  events: {
    onChange: [
      { type: 'setState', key: 'selectedCity', value: '{{event}}' },
    ],
  },
  allDeps: ['state.selectedCity'],
};

// --- Tag loop (场景 5) ---
// loop 节点：step 3 会短路，只渲染 loop.body，外层属性仅保留 loop 相关
const tagLoopBody: CompiledNode = {
  id: 'tag_loop',
  Component: null,
  componentType: 'Tag',
  staticProps: {},
  dynamicProps: {},
  loop: {
    dataFn: expr('{{state.tags}}', (ctx) => ctx.state.tags ?? [], ['state.tags']),
    itemKey: 'item',
    indexKey: 'index',
    keyFn: expr('{{item.id}}', (ctx) => ctx.item?.id ?? ctx.index),
    body: {
      Component: null,
      componentType: 'Tag',
      staticProps: {},
      dynamicProps: {
        color: expr('{{item.color}}', (ctx) => ctx.item?.color ?? 'default'),
      },
      ifFn: expr('{{item.visible}}', (ctx) => ctx.item?.visible),
      childrenFn: expr('{{item.label}}', (ctx) => ctx.item?.label ?? ''),
      allDeps: [],
    },
  },
  allDeps: ['state.tags'],
};

const tagContainerNode: CompiledNode = {
  id: 'tag_container',
  Component: null,
  componentType: 'Container',
  staticProps: { direction: 'row', gap: 8, wrap: 'wrap' },
  dynamicProps: {},
  compiledChildren: [tagLoopBody],
  allDeps: ['state.tags'],
};

// --- Alert + if (场景 6) ---
const alertNode: CompiledNode = {
  id: 'alert_info',
  Component: null,
  componentType: 'Alert',
  staticProps: { type: 'info', showIcon: true },
  dynamicProps: {
    title: expr(
      '{{state.keyword ? "搜索: " + state.keyword : "请输入搜索关键词"}}',
      (ctx) => ctx.state.keyword ? `搜索: ${ctx.state.keyword}` : '请输入搜索关键词',
      ['state.keyword'],
    ),
  },
  ifFn: expr('{{state.showAlert}}', (ctx) => ctx.state.showAlert, ['state.showAlert']),
  allDeps: ['state.keyword', 'state.showAlert'],
};

// --- Button (场景 1) ---
const buttonNode: CompiledNode = {
  id: 'submit_btn',
  Component: null,
  componentType: 'Button',
  staticProps: { type: 'primary' },
  dynamicProps: {
    loading: expr('{{state.loading}}', (ctx) => Boolean(ctx.state.loading), ['state.loading']),
  },
  childrenFn: expr('{{state.submitText}}', (ctx) => ctx.state.submitText ?? '提交', ['state.submitText']),
  events: {
    onClick: [{ type: 'callMethod', name: 'handleSubmit' }],
  },
  allDeps: ['state.loading', 'state.submitText'],
};

// --- Card title slot (场景 4) ---
const cardTitleSlot: CompiledNode = {
  Component: null,
  componentType: '__fragment',
  staticProps: {},
  dynamicProps: {},
  childrenFn: expr('Shenbi 低代码引擎 Demo', () => 'Shenbi 低代码引擎 Demo'),
  allDeps: [],
};

const cardExtraSlot: CompiledNode = {
  Component: null,
  componentType: 'Button',
  staticProps: { type: 'link', size: 'small' },
  dynamicProps: {},
  childrenFn: expr('更多', () => '更多'),
  allDeps: [],
};

// --- Card (场景 4) wrapping all ---
const cardNode: CompiledNode = {
  id: 'main_card',
  Component: null,
  componentType: 'Card',
  staticProps: {},
  dynamicProps: {},
  compiledSlots: {
    title: cardTitleSlot,
    extra: cardExtraSlot,
  },
  compiledChildren: [inputNode, selectNode, tagContainerNode, alertNode, buttonNode],
  allDeps: [],
};

// --- Root Container ---
export const demoCompiledBody: CompiledNode = {
  id: 'root',
  Component: null,
  componentType: 'Container',
  staticProps: { direction: 'column', gap: 16 },
  dynamicProps: {},
  compiledChildren: [cardNode],
  allDeps: [],
};
