import { COMPONENT_CONTRACT_V1_VERSION, } from '../types/contract';
// Layout 主组件
export const layoutContract = {
    componentType: 'Layout',
    runtimeType: 'antd.Layout',
    category: 'layout',
    icon: 'Layout',
    version: COMPONENT_CONTRACT_V1_VERSION,
    props: {
        hasSider: {
            type: 'boolean',
            default: false,
            description: '是否包含 Sider',
        },
        className: {
            type: 'string',
            description: '容器 className',
        },
        style: {
            type: 'object',
            description: '样式对象',
        },
        rootClassName: {
            type: 'string',
            description: '最外层容器 className',
        },
    },
    events: {},
    slots: {},
    children: {
        type: 'nodes',
        description: 'Layout 子组件（Header, Content, Footer, Sider）',
    },
};
// Layout.Header
export const layoutHeaderContract = {
    componentType: 'Layout.Header',
    runtimeType: 'antd.Layout.Header',
    category: 'layout',
    icon: 'PanelTop',
    version: COMPONENT_CONTRACT_V1_VERSION,
    props: {
        className: {
            type: 'string',
            description: '容器 className',
        },
        style: {
            type: 'object',
            description: '样式对象',
        },
    },
    events: {},
    slots: {},
    children: {
        type: 'nodes',
        description: 'Header 内容',
    },
};
// Layout.Content
export const layoutContentContract = {
    componentType: 'Layout.Content',
    runtimeType: 'antd.Layout.Content',
    category: 'layout',
    icon: 'LayoutDashboard',
    version: COMPONENT_CONTRACT_V1_VERSION,
    props: {
        className: {
            type: 'string',
            description: '容器 className',
        },
        style: {
            type: 'object',
            description: '样式对象',
        },
    },
    events: {},
    slots: {},
    children: {
        type: 'nodes',
        description: 'Content 内容',
    },
};
// Layout.Footer
export const layoutFooterContract = {
    componentType: 'Layout.Footer',
    runtimeType: 'antd.Layout.Footer',
    category: 'layout',
    icon: 'PanelBottom',
    version: COMPONENT_CONTRACT_V1_VERSION,
    props: {
        className: {
            type: 'string',
            description: '容器 className',
        },
        style: {
            type: 'object',
            description: '样式对象',
        },
    },
    events: {},
    slots: {},
    children: {
        type: 'nodes',
        description: 'Footer 内容',
    },
};
// Layout.Sider
export const layoutSiderContract = {
    componentType: 'Layout.Sider',
    runtimeType: 'antd.Layout.Sider',
    category: 'layout',
    icon: 'PanelLeft',
    version: COMPONENT_CONTRACT_V1_VERSION,
    props: {
        breakpoint: {
            type: 'enum',
            enum: ['xs', 'sm', 'md', 'lg', 'xl', 'xxl'],
            description: '触发响应式布局的断点',
        },
        collapsed: {
            type: 'boolean',
            allowExpression: true,
            description: '当前收起状态',
        },
        collapsedWidth: {
            type: 'number',
            default: 80,
            description: '收缩宽度',
        },
        collapsible: {
            type: 'boolean',
            default: false,
            description: '是否可收起',
        },
        defaultCollapsed: {
            type: 'boolean',
            default: false,
            description: '默认收起状态',
        },
        reverseArrow: {
            type: 'boolean',
            default: false,
            description: '翻转折叠提示箭头的方向',
        },
        theme: {
            type: 'enum',
            enum: ['light', 'dark'],
            default: 'dark',
            description: '主题',
        },
        trigger: {
            type: 'SchemaNode',
            description: '自定义触发器',
        },
        width: {
            type: 'number',
            default: 200,
            description: '宽度',
        },
        zeroWidthTriggerStyle: {
            type: 'object',
            description: '零宽度触发器样式',
        },
    },
    events: {
        onBreakpoint: {
            description: '触发响应式布局断点回调',
            params: [{ name: 'broken', type: 'boolean' }],
        },
        onCollapse: {
            description: '收起/展开回调',
            params: [
                { name: 'collapsed', type: 'boolean' },
                { name: 'type', type: "'clickTrigger' | 'responsive'" },
            ],
        },
    },
    slots: {},
    children: {
        type: 'nodes',
        description: 'Sider 内容',
    },
};
