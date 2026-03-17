import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { ConfigProvider, App } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { NodeRenderer, ShenbiContext, PageErrorBoundary } from '@shenbi/engine';
import type { PageSchema, CompiledNode } from '@shenbi/schema';
import * as antd from 'antd';

// 简化的 Runtime 实现（用于视觉测试）
function createMockRuntime() {
  const state = { __permissions: [] as string[] };
  const refs = new Map<string, any>();

  return {
    state,
    getContext: (extra?: Record<string, any>) => ({
      state,
      ...extra,
    }),
    executeActions: async () => {},
    registerRef: (id: string, el: any) => {
      if (el) refs.set(id, el);
      else refs.delete(id);
    },
    dispatch: () => {},
  };
}

// 组件映射表
const componentMapping: Record<string, string> = {
  'Button': 'Button',
  'Input': 'Input',
  'Input.TextArea': 'Input.TextArea',
  'Select': 'Select',
  'Radio': 'Radio',
  'Radio.Group': 'Radio.Group',
  'Checkbox': 'Checkbox',
  'Checkbox.Group': 'Checkbox.Group',
  'Switch': 'Switch',
  'Slider': 'Slider',
  'Rate': 'Rate',
  'InputNumber': 'InputNumber',
  'Cascader': 'Cascader',
  'DatePicker': 'DatePicker',
  'TimePicker': 'TimePicker',
  'TreeSelect': 'TreeSelect',
  'Tree': 'Tree',
  'Form': 'Form',
  'Form.Item': 'Form.Item',
  'Upload': 'Upload',
  'Transfer': 'Transfer',
  'Table': 'Table',
  'Card': 'Card',
  'Tabs': 'Tabs',
  'TabPane': 'TabPane',
  'Modal': 'Modal',
  'Drawer': 'Drawer',
  'Message': 'Message',
  'Notification': 'Notification',
  'Alert': 'Alert',
  'Result': 'Result',
  'Spin': 'Spin',
  'Progress': 'Progress',
  'Badge': 'Badge',
  'Tag': 'Tag',
  'Avatar': 'Avatar',
  'Space': 'Space',
  'Row': 'Row',
  'Col': 'Col',
  'Flex': 'Flex',
  'Divider': 'Divider',
  'Typography': 'Typography',
  'Typography.Text': 'Typography.Text',
  'Typography.Title': 'Typography.Title',
  'Typography.Paragraph': 'Typography.Paragraph',
  'Typography.Link': 'Typography.Link',
  'Breadcrumb': 'Breadcrumb',
  'Breadcrumb.Item': 'Breadcrumb.Item',
  'Menu': 'Menu',
  'Dropdown': 'Dropdown',
  'Steps': 'Steps',
  'Steps.Step': 'Steps.Step',
  'Timeline': 'Timeline',
  'Timeline.Item': 'Timeline.Item',
  'Descriptions': 'Descriptions',
  'Descriptions.Item': 'Descriptions.Item',
  'Statistic': 'Statistic',
  'Countdown': 'Countdown',
  'Collapse': 'Collapse',
  'Collapse.Panel': 'Collapse.Panel',
  'Carousel': 'Carousel',
  'Image': 'Image',
  'List': 'List',
  'List.Item': 'List.Item',
  'Comment': 'Comment',
  'Calendar': 'Calendar',
  'Empty': 'Empty',
  'Popconfirm': 'Popconfirm',
  'Popover': 'Popover',
  'Tooltip': 'Tooltip',
  'Affix': 'Affix',
  'Anchor': 'Anchor',
  'Anchor.Link': 'Anchor.Link',
  'BackTop': 'BackTop',
  'QRCode': 'QRCode',
  'Tour': 'Tour',
  'FloatButton': 'FloatButton',
  'Watermark': 'Watermark',
  'Segmented': 'Segmented',
  'AutoComplete': 'AutoComplete',
  'Mentions': 'Mentions',
  'ColorPicker': 'ColorPicker',
  'Icon': 'Icon',
};

// 简化的 Resolver 实现
function createMockResolver() {
  return {
    resolve: (componentType: string) => {
      const mappedName = componentMapping[componentType];
      if (!mappedName) {
        console.warn(`Unknown component: ${componentType}`);
        return null;
      }

      // 处理嵌套路径如 Input.TextArea
      const parts = mappedName.split('.');
      let comp: any = antd;
      for (const part of parts) {
        comp = comp?.[part];
      }

      if (!comp) {
        console.warn(`Component not found: ${mappedName}`);
        return null;
      }

      return comp;
    },
  };
}

function initApp() {
  const rootElement = document.getElementById('root');
  if (!rootElement) return;

  const runtime = createMockRuntime();
  const resolver = createMockResolver();

  function getSchemaFromURL(): PageSchema | null {
    const params = new URLSearchParams(window.location.search);
    const schemaParam = params.get('schema');

    if (schemaParam) {
      try {
        return JSON.parse(decodeURIComponent(schemaParam));
      } catch (error) {
        console.error('解析 schema 失败:', error);
        return null;
      }
    }

    // 默认 schema
    return {
      body: [{
        component: 'Button',
        props: { type: 'primary', children: 'Hello World' },
      }],
    };
  }

  // 递归编译 props 中的嵌套 SchemaNode
  function compilePropObjects(propValue: any): any {
    if (!propValue || typeof propValue !== 'object') return propValue;

    if (Array.isArray(propValue)) {
      return propValue.map(item => compilePropObjects(item));
    }

    // 检查是否是 SchemaNode 格式
    if (propValue.component && typeof propValue.component === 'string') {
      // 这是一个 SchemaNode，需要编译
      const compiledNode: CompiledNode = {
        id: propValue.id || `prop-node-${Math.random()}`,
        componentType: propValue.component,
        staticProps: compilePropObjects(propValue.props || {}),
        dynamicProps: {},
        childrenFn: propValue.children
          ? () => Array.isArray(propValue.children)
            ? propValue.children
            : [propValue.children]
          : undefined,
        ifFn: undefined,
        showFn: undefined,
        events: undefined,
        loop: undefined,
        compiledChildren: [],
        compiledSlots: {},
        style: undefined,
        className: undefined,
        errorBoundary: undefined,
        compiledColumns: undefined,
        compiledPropNodes: {},
        permission: undefined,
        Component: undefined,
      };
      return createElement(NodeRenderer, { node: compiledNode });
    }

    // 普通对象，递归处理所有属性
    const result: Record<string, any> = {};
    for (const [key, value] of Object.entries(propValue)) {
      result[key] = compilePropObjects(value);
    }
    return result;
  }

  function SchemaRenderer({ schema }: { schema: PageSchema }) {
    // 将 PageSchema 转换为 CompiledNode 数组
    // 在视觉测试中，我们直接使用简化的编译逻辑
    const compiledNodes: CompiledNode[] = schema.body.map((node, index) => ({
      id: node.id || `node-${index}`,
      componentType: node.component,
      staticProps: compilePropObjects(node.props || {}),
      dynamicProps: {},
      childrenFn: undefined,
      ifFn: node.if ? () => true : undefined,
      showFn: undefined,
      events: undefined,
      loop: undefined,
      compiledChildren: [],
      compiledSlots: {},
      style: undefined,
      className: undefined,
      errorBoundary: undefined,
      compiledColumns: undefined,
      compiledPropNodes: {},
      permission: undefined,
      Component: undefined,
    }));

    return createElement(
      ShenbiContext.Provider,
      { value: { runtime, resolver, getPopupContainer: undefined } },
      createElement(PageErrorBoundary, null,
        createElement('div', { className: 'schema-body' },
          compiledNodes.map((node, i) =>
            createElement(NodeRenderer, { key: node.id || i, node })
          )
        )
      )
    );
  }

  const schema = getSchemaFromURL();
  if (!schema) {
    rootElement.innerHTML = `
      <div style="background: #fff2f0; border: 1px solid #ffccc7; border-radius: 8px; padding: 16px; color: #cf1322;">
        <div style="font-weight: 600; margin-bottom: 8px;">Schema 解析失败</div>
        <p>请检查 URL 中的 schema 参数是否正确</p>
      </div>
    `;
    return;
  }

  const root = createRoot(rootElement);
  root.render(
    createElement(ConfigProvider, {
      locale: zhCN,
      theme: {
        token: {
          colorPrimary: '#1677ff',
        },
      },
    },
      createElement(App, null,
        createElement(SchemaRenderer, { schema })
      )
    )
  );
}

// 启动应用
initApp();
