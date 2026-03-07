import { COMPONENT_CONTRACT_V1_VERSION, } from '../types/contract';
// Tree 组件
export const treeContract = {
    componentType: 'Tree',
    runtimeType: 'antd.Tree',
    category: 'data-display',
    icon: 'TreePine',
    version: COMPONENT_CONTRACT_V1_VERSION,
    props: {
        treeData: {
            type: 'array',
            allowExpression: true,
            description: '树形结构数据',
        },
        checkable: {
            type: 'boolean',
            default: false,
            allowExpression: true,
            description: '节点前添加 Checkbox',
        },
        checkedKeys: {
            type: 'any',
            default: [],
            allowExpression: true,
            description: '选中复选框的树节点',
        },
        defaultCheckedKeys: {
            type: 'array',
            default: [],
            description: '默认选中复选框的树节点',
        },
        checkStrictly: {
            type: 'boolean',
            default: false,
            allowExpression: true,
            description: 'checkable 状态下节点选择完全受控',
        },
        expandedKeys: {
            type: 'array',
            default: [],
            allowExpression: true,
            description: '展开指定的树节点',
        },
        defaultExpandedKeys: {
            type: 'array',
            default: [],
            description: '默认展开指定的树节点',
        },
        defaultExpandAll: {
            type: 'boolean',
            default: false,
            description: '默认展开所有树节点',
        },
        autoExpandParent: {
            type: 'boolean',
            default: false,
            allowExpression: true,
            description: '是否自动展开父节点',
        },
        selectedKeys: {
            type: 'array',
            allowExpression: true,
            description: '设置选中的树节点',
        },
        defaultSelectedKeys: {
            type: 'array',
            default: [],
            description: '默认选中的树节点',
        },
        selectable: {
            type: 'boolean',
            default: true,
            allowExpression: true,
            description: '是否可选中',
        },
        multiple: {
            type: 'boolean',
            default: false,
            allowExpression: true,
            description: '支持点选多个节点',
        },
        disabled: {
            type: 'boolean',
            default: false,
            allowExpression: true,
            description: '将树禁用',
        },
        draggable: {
            type: 'any',
            default: false,
            allowExpression: true,
            description: '设置节点可拖拽',
        },
        showIcon: {
            type: 'boolean',
            default: false,
            allowExpression: true,
            description: '是否展示图标',
        },
        icon: {
            type: 'SchemaNode',
            description: '自定义图标',
        },
        showLine: {
            type: 'any',
            default: false,
            allowExpression: true,
            description: '是否展示连接线',
        },
        switcherIcon: {
            type: 'SchemaNode',
            description: '自定义树节点的展开/折叠图标',
        },
        blockNode: {
            type: 'boolean',
            default: false,
            allowExpression: true,
            description: '是否节点占据一行',
        },
        loadData: {
            type: 'function',
            description: '异步加载数据',
        },
        loadedKeys: {
            type: 'array',
            allowExpression: true,
            description: '已经加载的节点',
        },
        fieldNames: {
            type: 'object',
            default: { title: 'title', key: 'key', children: 'children' },
            allowExpression: true,
            description: '自定义节点 title、key、children 的字段',
        },
        filterTreeNode: {
            type: 'function',
            description: '按需筛选树节点',
        },
        height: {
            type: 'number',
            allowExpression: true,
            description: '设置虚拟滚动容器高度',
        },
        virtual: {
            type: 'boolean',
            default: true,
            allowExpression: true,
            description: '设置 false 时关闭虚拟滚动',
        },
        titleRender: {
            type: 'function',
            description: '自定义渲染节点',
        },
        allowDrop: {
            type: 'function',
            description: '是否允许拖拽时放置在该节点',
        },
    },
    events: {
        onSelect: {
            description: '点击树节点触发',
            params: [
                { name: 'selectedKeys', type: 'string[]' },
                { name: 'info', type: 'any' },
            ],
        },
        onCheck: {
            description: '点击复选框触发',
            params: [
                { name: 'checkedKeys', type: 'any' },
                { name: 'info', type: 'any' },
            ],
        },
        onExpand: {
            description: '展开/收起节点时触发',
            params: [
                { name: 'expandedKeys', type: 'string[]' },
                { name: 'info', type: 'any' },
            ],
        },
        onLoad: {
            description: '节点加载完毕时触发',
            params: [
                { name: 'loadedKeys', type: 'string[]' },
                { name: 'info', type: 'any' },
            ],
        },
        onRightClick: {
            description: '响应右键点击',
            params: [{ name: 'info', type: 'any' }],
        },
        onDoubleClick: {
            description: '双击树节点触发',
            params: [
                { name: 'event', type: 'Event' },
                { name: 'node', type: 'any' },
            ],
        },
        onDragStart: {
            description: '开始拖拽时调用',
            params: [{ name: 'info', type: 'any' }],
        },
        onDragEnter: {
            description: 'dragenter 触发时调用',
            params: [{ name: 'info', type: 'any' }],
        },
        onDragOver: {
            description: 'dragover 触发时调用',
            params: [{ name: 'info', type: 'any' }],
        },
        onDragLeave: {
            description: 'dragleave 触发时调用',
            params: [{ name: 'info', type: 'any' }],
        },
        onDragEnd: {
            description: 'dragend 触发时调用',
            params: [{ name: 'info', type: 'any' }],
        },
        onDrop: {
            description: 'drop 触发时调用',
            params: [{ name: 'info', type: 'any' }],
        },
    },
    slots: {},
    children: {
        type: 'none',
        description: '使用 treeData 属性配置',
    },
};
// TreeNode（用于 treeData 中的节点）
export const treeNodeContract = {
    componentType: 'Tree.TreeNode',
    runtimeType: 'antd.Tree.TreeNode',
    category: 'data-display',
    icon: 'GitBranch',
    version: COMPONENT_CONTRACT_V1_VERSION,
    props: {
        key: {
            type: 'string',
            description: '节点 key',
        },
        title: {
            type: 'SchemaNode',
            description: '标题',
        },
        icon: {
            type: 'SchemaNode',
            description: '自定义图标',
        },
        disabled: {
            type: 'boolean',
            default: false,
            allowExpression: true,
            description: '禁掉响应',
        },
        disableCheckbox: {
            type: 'boolean',
            default: false,
            allowExpression: true,
            description: '禁掉 checkbox',
        },
        selectable: {
            type: 'boolean',
            default: true,
            allowExpression: true,
            description: '设置节点是否可被选中',
        },
        checkable: {
            type: 'boolean',
            allowExpression: true,
            description: '当树为 checkable 时，设置独立节点是否展示 Checkbox',
        },
        isLeaf: {
            type: 'boolean',
            allowExpression: true,
            description: '设置叶子节点',
        },
    },
    events: {},
    slots: {},
    children: {
        type: 'nodes',
        description: '子节点',
    },
};
// DirectoryTree
export const directoryTreeContract = {
    componentType: 'Tree.DirectoryTree',
    runtimeType: 'antd.Tree.DirectoryTree',
    category: 'data-display',
    icon: 'FolderTree',
    version: COMPONENT_CONTRACT_V1_VERSION,
    props: {
        expandAction: {
            type: 'any',
            default: 'click',
            allowExpression: true,
            description: '目录展开逻辑',
        },
        // 继承 Tree 的所有 props
        treeData: {
            type: 'array',
            allowExpression: true,
            description: '树形结构数据',
        },
        checkable: {
            type: 'boolean',
            default: false,
            allowExpression: true,
            description: '节点前添加 Checkbox',
        },
        expandedKeys: {
            type: 'array',
            default: [],
            allowExpression: true,
            description: '展开指定的树节点',
        },
        selectedKeys: {
            type: 'array',
            allowExpression: true,
            description: '设置选中的树节点',
        },
    },
    events: {
        onSelect: {
            description: '点击树节点触发',
            params: [
                { name: 'selectedKeys', type: 'string[]' },
                { name: 'info', type: 'any' },
            ],
        },
        onExpand: {
            description: '展开/收起节点时触发',
            params: [
                { name: 'expandedKeys', type: 'string[]' },
                { name: 'info', type: 'any' },
            ],
        },
    },
    slots: {},
    children: {
        type: 'none',
        description: '使用 treeData 属性配置',
    },
};
