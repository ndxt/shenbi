import { COMPONENT_CONTRACT_V1_VERSION, } from '../types/contract';
// Anchor
export const anchorContract = {
    componentType: 'Anchor',
    runtimeType: 'antd.Anchor',
    category: 'navigation',
    icon: 'Anchor',
    version: COMPONENT_CONTRACT_V1_VERSION,
    props: {
        affix: {
            type: 'boolean',
            default: true,
            allowExpression: true,
            description: '固定模式',
        },
        bounds: {
            type: 'number',
            default: 5,
            allowExpression: true,
            description: '锚点区域边界',
        },
        targetOffset: {
            type: 'number',
            allowExpression: true,
            description: '锚点滚动偏移量',
        },
        offsetTop: {
            type: 'number',
            default: 0,
            allowExpression: true,
            description: '距离顶部偏移',
        },
        showInkInFixed: {
            type: 'boolean',
            default: false,
            allowExpression: true,
            description: '固定模式下是否显示小圆点',
        },
        direction: {
            type: 'enum',
            enum: ['vertical', 'horizontal'],
            default: 'vertical',
            allowExpression: true,
            description: '锚点方向',
        },
        items: {
            type: 'array',
            allowExpression: true,
            description: '数据配置',
        },
        replace: {
            type: 'boolean',
            default: false,
            allowExpression: true,
            description: '是否替换历史记录',
        },
    },
    events: {
        onChange: {
            description: '监听锚点链接改变',
            params: [{ name: 'currentActiveLink', type: 'string' }],
        },
        onClick: {
            description: '点击锚点链接触发',
            params: [
                { name: 'e', type: 'MouseEvent' },
                { name: 'link', type: 'object' },
            ],
        },
    },
    slots: {},
    children: {
        type: 'none',
        description: '使用 items 配置',
    },
};
// Breadcrumb
export const breadcrumbContract = {
    componentType: 'Breadcrumb',
    runtimeType: 'antd.Breadcrumb',
    category: 'navigation',
    icon: 'ChevronRight',
    version: COMPONENT_CONTRACT_V1_VERSION,
    props: {
        items: {
            type: 'array',
            allowExpression: true,
            description: '路由栈信息',
        },
        separator: {
            type: 'SchemaNode',
            default: '/',
            description: '分隔符',
        },
        itemRender: {
            type: 'function',
            description: '自定义链接函数',
        },
        params: {
            type: 'object',
            allowExpression: true,
            description: '路由参数',
        },
    },
    events: {},
    slots: {},
    children: {
        type: 'none',
        description: '使用 items 配置',
    },
};
// Dropdown
export const dropdownContract = {
    componentType: 'Dropdown',
    runtimeType: 'antd.Dropdown',
    category: 'navigation',
    icon: 'ChevronDown',
    version: COMPONENT_CONTRACT_V1_VERSION,
    props: {
        menu: {
            type: 'object',
            allowExpression: true,
            description: '菜单配置',
        },
        open: {
            type: 'boolean',
            allowExpression: true,
            description: '菜单是否显示',
        },
        disabled: {
            type: 'boolean',
            default: false,
            allowExpression: true,
            description: '是否禁用',
        },
        placement: {
            type: 'enum',
            enum: ['bottom', 'bottomLeft', 'bottomRight', 'top', 'topLeft', 'topRight'],
            default: 'bottomLeft',
            allowExpression: true,
            description: '菜单弹出位置',
        },
        trigger: {
            type: 'array',
            default: ['hover'],
            allowExpression: true,
            description: '触发行为',
        },
        arrow: {
            type: 'boolean',
            default: false,
            allowExpression: true,
            description: '下拉框箭头是否可见',
        },
        destroyOnHidden: {
            type: 'boolean',
            default: false,
            allowExpression: true,
            description: '关闭时销毁',
        },
    },
    events: {
        onOpenChange: {
            description: '菜单显示状态改变时调用',
            params: [
                { name: 'open', type: 'boolean' },
                { name: 'info', type: 'object' },
            ],
        },
    },
    slots: {},
    children: {
        type: 'node',
        description: '触发元素',
    },
};
// Menu
export const menuContract = {
    componentType: 'Menu',
    runtimeType: 'antd.Menu',
    category: 'navigation',
    icon: 'Menu',
    version: COMPONENT_CONTRACT_V1_VERSION,
    props: {
        items: {
            type: 'array',
            allowExpression: true,
            description: '菜单内容',
        },
        mode: {
            type: 'enum',
            enum: ['horizontal', 'vertical', 'inline'],
            default: 'vertical',
            allowExpression: true,
            description: '菜单类型',
        },
        theme: {
            type: 'enum',
            enum: ['light', 'dark'],
            default: 'light',
            allowExpression: true,
            description: '主题',
        },
        selectedKeys: {
            type: 'array',
            allowExpression: true,
            description: '当前选中的菜单项 key',
        },
        defaultSelectedKeys: {
            type: 'array',
            default: [],
            description: '初始选中的菜单项 key',
        },
        openKeys: {
            type: 'array',
            allowExpression: true,
            description: '当前展开的子菜单 key',
        },
        defaultOpenKeys: {
            type: 'array',
            description: '初始展开的子菜单 key',
        },
        inlineCollapsed: {
            type: 'boolean',
            allowExpression: true,
            description: 'inline 模式的折叠状态',
        },
        inlineIndent: {
            type: 'number',
            default: 24,
            allowExpression: true,
            description: 'inline 模式的子菜单缩进',
        },
        multiple: {
            type: 'boolean',
            default: false,
            allowExpression: true,
            description: '是否允许多选',
        },
        selectable: {
            type: 'boolean',
            default: true,
            allowExpression: true,
            description: '是否允许选中',
        },
        triggerSubMenuAction: {
            type: 'enum',
            enum: ['hover', 'click'],
            default: 'hover',
            allowExpression: true,
            description: 'SubMenu 展开/关闭的触发行为',
        },
    },
    events: {
        onClick: {
            description: '点击菜单项时的回调',
            params: [{ name: 'info', type: 'object' }],
        },
        onSelect: {
            description: '选中菜单项时的回调',
            params: [{ name: 'info', type: 'object' }],
        },
        onDeselect: {
            description: '取消选中菜单项时的回调',
            params: [{ name: 'info', type: 'object' }],
        },
        onOpenChange: {
            description: 'Sub Menu 展开关闭的回调',
            params: [{ name: 'openKeys', type: 'string[]' }],
        },
    },
    slots: {},
    children: {
        type: 'none',
        description: '使用 items 配置',
    },
};
// Pagination
export const paginationContract = {
    componentType: 'Pagination',
    runtimeType: 'antd.Pagination',
    category: 'navigation',
    icon: 'MoreHorizontal',
    version: COMPONENT_CONTRACT_V1_VERSION,
    props: {
        current: {
            type: 'number',
            allowExpression: true,
            description: '当前页数',
        },
        defaultCurrent: {
            type: 'number',
            default: 1,
            description: '默认的当前页数',
        },
        total: {
            type: 'number',
            default: 0,
            allowExpression: true,
            description: '数据总数',
        },
        pageSize: {
            type: 'number',
            allowExpression: true,
            description: '每页条数',
        },
        defaultPageSize: {
            type: 'number',
            default: 10,
            description: '默认的每页条数',
        },
        pageSizeOptions: {
            type: 'array',
            default: [10, 20, 50, 100],
            allowExpression: true,
            description: '指定每页可以显示多少条',
        },
        showSizeChanger: {
            type: 'boolean',
            allowExpression: true,
            description: '是否展示 pageSize 切换器',
        },
        showQuickJumper: {
            type: 'any',
            default: false,
            allowExpression: true,
            description: '是否可以快速跳转至某页',
        },
        showTotal: {
            type: 'function',
            description: '用于显示数据总量和当前数据顺序',
        },
        simple: {
            type: 'any',
            allowExpression: true,
            description: '简洁模式',
        },
        size: {
            type: 'enum',
            enum: ['default', 'small'],
            allowExpression: true,
            description: '当为 small 时，是小尺寸分页',
        },
        disabled: {
            type: 'boolean',
            default: false,
            allowExpression: true,
            description: '是否禁用',
        },
        hideOnSinglePage: {
            type: 'boolean',
            default: false,
            allowExpression: true,
            description: '只有一页时是否隐藏分页器',
        },
        align: {
            type: 'enum',
            enum: ['start', 'center', 'end'],
            allowExpression: true,
            description: '对齐方式',
        },
    },
    events: {
        onChange: {
            description: '页码改变的回调',
            params: [
                { name: 'page', type: 'number' },
                { name: 'pageSize', type: 'number' },
            ],
        },
        onShowSizeChange: {
            description: 'pageSize 变化的回调',
            params: [
                { name: 'current', type: 'number' },
                { name: 'size', type: 'number' },
            ],
        },
    },
    slots: {},
    children: {
        type: 'none',
    },
};
// Steps
export const stepsContract = {
    componentType: 'Steps',
    runtimeType: 'antd.Steps',
    category: 'navigation',
    icon: 'ListOrdered',
    version: COMPONENT_CONTRACT_V1_VERSION,
    props: {
        current: {
            type: 'number',
            default: 0,
            allowExpression: true,
            description: '当前步骤，从 0 开始',
        },
        initial: {
            type: 'number',
            default: 0,
            allowExpression: true,
            description: '起始步骤序号',
        },
        direction: {
            type: 'enum',
            enum: ['horizontal', 'vertical'],
            default: 'horizontal',
            allowExpression: true,
            description: '步骤条方向',
        },
        labelPlacement: {
            type: 'enum',
            enum: ['horizontal', 'vertical'],
            default: 'horizontal',
            allowExpression: true,
            description: '标签放置位置',
        },
        percent: {
            type: 'number',
            allowExpression: true,
            description: '当前步骤的进度',
        },
        progressDot: {
            type: 'any',
            default: false,
            allowExpression: true,
            description: '点状步骤条',
        },
        size: {
            type: 'enum',
            enum: ['default', 'small'],
            default: 'default',
            allowExpression: true,
            description: '步骤条大小',
        },
        status: {
            type: 'enum',
            enum: ['wait', 'process', 'finish', 'error'],
            default: 'process',
            allowExpression: true,
            description: '当前步骤状态',
        },
        type: {
            type: 'enum',
            enum: ['default', 'dot', 'inline', 'navigation', 'panel'],
            default: 'default',
            allowExpression: true,
            description: '步骤条类型',
        },
        items: {
            type: 'array',
            allowExpression: true,
            description: '配置选项卡内容',
        },
        responsive: {
            type: 'boolean',
            default: true,
            allowExpression: true,
            description: '屏幕宽度小于 532px 时自动垂直显示',
        },
    },
    events: {
        onChange: {
            description: '步骤改变时触发',
            params: [{ name: 'current', type: 'number' }],
        },
    },
    slots: {},
    children: {
        type: 'none',
        description: '使用 items 配置',
    },
};
