import { COMPONENT_CONTRACT_V1_VERSION, } from '../types/contract';
export const tableContract = {
    componentType: 'Table',
    runtimeType: 'antd.Table',
    category: 'data-display',
    icon: 'Table',
    version: COMPONENT_CONTRACT_V1_VERSION,
    props: {
        rowKey: {
            type: 'any',
            allowExpression: true,
            description: '行主键，支持字符串字段名或函数',
        },
        dataSource: {
            type: 'array',
            allowExpression: true,
        },
        columns: {
            type: 'array',
            allowExpression: true,
        },
        loading: {
            type: 'boolean',
            default: false,
            allowExpression: true,
        },
        bordered: {
            type: 'boolean',
            default: false,
            allowExpression: true,
        },
        size: {
            type: 'enum',
            enum: ['small', 'middle', 'large'],
            allowExpression: true,
        },
        pagination: {
            type: 'object',
            allowExpression: true,
        },
        rowSelection: {
            type: 'object',
            allowExpression: true,
        },
        editable: {
            type: 'object',
            allowExpression: true,
            description: '扩展字段：editingKey 等',
        },
    },
    events: {
        onChange: {
            params: [
                { name: 'pagination', type: 'any' },
                { name: 'filters', type: 'any' },
                { name: 'sorter', type: 'any' },
                { name: 'extra', type: 'any' },
            ],
        },
        'rowSelection.onChange': {
            params: [
                { name: 'selectedRowKeys', type: 'any[]' },
                { name: 'selectedRows', type: 'any[]' },
                { name: 'info', type: 'any' },
            ],
        },
    },
    slots: {},
    children: {
        type: 'none',
    },
};
