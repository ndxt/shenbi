import { Fragment, type ComponentType } from 'react';
import type { ComponentResolver } from '../types/contracts';

const ANTD_COMPONENT_NAMES = [
  // 通用
  'Button',
  'Typography',
  // 布局
  'Row', 'Col', 'Layout', 'Space', 'Divider', 'Flex',
  // 导航
  'Menu', 'Breadcrumb', 'Dropdown', 'Pagination', 'Steps',
  // 数据录入
  'Form', 'Input', 'InputNumber', 'Select', 'Cascader', 'TreeSelect',
  'DatePicker', 'TimePicker', 'Checkbox', 'Radio',
  'Switch', 'Slider', 'Upload', 'Transfer', 'ColorPicker', 'Rate', 'Mentions',
  // 数据展示
  'Table', 'Descriptions', 'List', 'Card', 'Tabs', 'Tree',
  'Collapse', 'Timeline', 'Tag', 'Tooltip', 'Popover', 'Popconfirm',
  'Badge', 'Avatar', 'Calendar', 'Carousel', 'Image',
  'Statistic', 'Segmented', 'Empty', 'QRCode',
  // 反馈
  'Modal', 'Drawer', 'Alert', 'Progress', 'Skeleton', 'Spin', 'Result', 'Watermark',
  // 其他
  'Anchor', 'FloatButton', 'Splitter', 'ConfigProvider', 'App',
] as const;

export function antdResolver(antdModule: Record<string, any>): ComponentResolver {
  const map: Record<string, ComponentType<any>> = {};
  for (const name of ANTD_COMPONENT_NAMES) {
    if (antdModule[name]) {
      map[name] = antdModule[name] as ComponentType<any>;
    }
  }
  return createResolver(map);
}

function resolveFromDotPath(source: Record<string, any>, path: string): any {
  return path.split('.').reduce((acc, key) => acc?.[key], source);
}

export function createResolver(
  initialMap: Record<string, ComponentType<any>> = {},
): ComponentResolver {
  const components: Record<string, ComponentType<any>> = { ...initialMap };

  return {
    resolve(componentType: string) {
      if (componentType === '__fragment') {
        return Fragment;
      }

      if (components[componentType]) {
        return components[componentType];
      }

      if (componentType.includes('.')) {
        const [root] = componentType.split('.');
        if (root && components[root]) {
          return resolveFromDotPath(components, componentType) ?? null;
        }
      }

      return null;
    },
    register(componentType: string, component: ComponentType<any>) {
      components[componentType] = component;
    },
    registerAll(map: Record<string, ComponentType<any>>) {
      Object.assign(components, map);
    },
    has(componentType: string) {
      return this.resolve(componentType) !== null;
    },
  };
}
