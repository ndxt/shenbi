import { COMPONENT_CONTRACT_V1_VERSION, } from '../types/contract';
// Divider
export const dividerContract = {
    componentType: 'Divider',
    runtimeType: 'antd.Divider',
    category: 'layout',
    icon: 'Minus',
    version: COMPONENT_CONTRACT_V1_VERSION,
    props: {
        dashed: {
            type: 'boolean',
            default: false,
            allowExpression: true,
            description: '是否虚线',
        },
        orientation: {
            type: 'enum',
            enum: ['horizontal', 'vertical'],
            default: 'horizontal',
            allowExpression: true,
            description: '分割线方向',
        },
        orientationMargin: {
            type: 'any',
            allowExpression: true,
            description: '标题位置偏移',
        },
        plain: {
            type: 'boolean',
            default: false,
            allowExpression: true,
            description: '文字是否显示为普通正文样式',
        },
        type: {
            type: 'enum',
            enum: ['horizontal', 'vertical'],
            default: 'horizontal',
            allowExpression: true,
            description: '分割线方向（已废弃，请用 orientation）',
            deprecated: true,
        },
        variant: {
            type: 'enum',
            enum: ['dashed', 'dotted', 'solid'],
            default: 'solid',
            allowExpression: true,
            description: '分割线样式',
        },
    },
    events: {},
    slots: {},
    children: {
        type: 'text',
        description: '标题文字',
    },
};
// Flex
export const flexContract = {
    componentType: 'Flex',
    runtimeType: 'antd.Flex',
    category: 'layout',
    icon: 'MoveHorizontal',
    version: COMPONENT_CONTRACT_V1_VERSION,
    props: {
        vertical: {
            type: 'boolean',
            default: false,
            allowExpression: true,
            description: '是否垂直布局',
        },
        wrap: {
            type: 'any',
            default: 'nowrap',
            allowExpression: true,
            description: '设置元素换行方式',
        },
        justify: {
            type: 'string',
            default: 'normal',
            allowExpression: true,
            description: '设置主轴对齐方式',
        },
        align: {
            type: 'string',
            default: 'normal',
            allowExpression: true,
            description: '设置交叉轴对齐方式',
        },
        flex: {
            type: 'string',
            default: 'normal',
            allowExpression: true,
            description: 'flex CSS 简写属性',
        },
        gap: {
            type: 'any',
            allowExpression: true,
            description: '设置子元素间距',
        },
        component: {
            type: 'string',
            default: 'div',
            description: '自定义元素类型',
        },
    },
    events: {},
    slots: {},
    children: {
        type: 'nodes',
        description: '子元素',
    },
};
// Masonry
export const masonryContract = {
    componentType: 'Masonry',
    runtimeType: 'antd.Masonry',
    category: 'layout',
    icon: 'LayoutGrid',
    version: COMPONENT_CONTRACT_V1_VERSION,
    props: {
        columns: {
            type: 'any',
            default: 3,
            allowExpression: true,
            description: '列数',
        },
        gutter: {
            type: 'any',
            default: 0,
            allowExpression: true,
            description: '间距',
        },
        items: {
            type: 'array',
            allowExpression: true,
            description: '瀑布流数据',
        },
        fresh: {
            type: 'boolean',
            default: false,
            allowExpression: true,
            description: '是否持续监听子元素尺寸变化',
        },
        sequential: {
            type: 'boolean',
            default: false,
            allowExpression: true,
            description: '是否按顺序排列',
        },
    },
    events: {
        onLayoutChange: {
            description: '列排序变化回调',
            params: [{ name: 'layout', type: 'any[]' }],
        },
    },
    slots: {},
    children: {
        type: 'nodes',
        description: '瀑布流子元素',
    },
};
// Splitter
export const splitterContract = {
    componentType: 'Splitter',
    runtimeType: 'antd.Splitter',
    category: 'layout',
    icon: 'SplitSquareHorizontal',
    version: COMPONENT_CONTRACT_V1_VERSION,
    props: {
        orientation: {
            type: 'enum',
            enum: ['horizontal', 'vertical'],
            default: 'horizontal',
            allowExpression: true,
            description: '布局方向',
        },
        lazy: {
            type: 'boolean',
            default: false,
            allowExpression: true,
            description: '懒加载模式',
        },
    },
    events: {
        onResize: {
            description: '面板大小变化回调',
            params: [{ name: 'sizes', type: 'number[]' }],
        },
        onResizeStart: {
            description: '拖拽开始回调',
            params: [{ name: 'sizes', type: 'number[]' }],
        },
        onResizeEnd: {
            description: '拖拽结束回调',
            params: [{ name: 'sizes', type: 'number[]' }],
        },
        onCollapse: {
            description: '展开/折叠回调',
            params: [
                { name: 'collapsed', type: 'boolean[]' },
                { name: 'sizes', type: 'number[]' },
            ],
        },
    },
    slots: {},
    children: {
        type: 'nodes',
        description: 'Splitter.Panel 列表',
    },
};
// Splitter.Panel
export const splitterPanelContract = {
    componentType: 'Splitter.Panel',
    runtimeType: 'antd.Splitter.Panel',
    category: 'layout',
    icon: 'Square',
    version: COMPONENT_CONTRACT_V1_VERSION,
    props: {
        size: {
            type: 'any',
            allowExpression: true,
            description: '面板尺寸（受控）',
        },
        defaultSize: {
            type: 'any',
            allowExpression: true,
            description: '初始面板尺寸',
        },
        min: {
            type: 'any',
            allowExpression: true,
            description: '最小阈值',
        },
        max: {
            type: 'any',
            allowExpression: true,
            description: '最大阈值',
        },
        collapsible: {
            type: 'any',
            allowExpression: true,
            description: '快捷折叠',
        },
        resizable: {
            type: 'boolean',
            default: true,
            allowExpression: true,
            description: '是否启用拖拽',
        },
    },
    events: {},
    slots: {},
    children: {
        type: 'nodes',
        description: '面板内容',
    },
};
