import { COMPONENT_CONTRACT_V1_VERSION, } from '../types/contract';
export const formItemContract = {
    componentType: 'Form.Item',
    runtimeType: 'antd.Form.Item',
    category: 'data-entry',
    icon: 'SquareDashedBottom',
    version: COMPONENT_CONTRACT_V1_VERSION,
    props: {
        name: {
            type: 'any',
            description: '字段路径，支持 string 或 string[]',
            allowExpression: true,
        },
        label: {
            type: 'string',
            allowExpression: true,
        },
        rules: {
            type: 'array',
            allowExpression: true,
        },
        required: {
            type: 'boolean',
            allowExpression: true,
        },
        valuePropName: {
            type: 'string',
            allowExpression: true,
        },
        dependencies: {
            type: 'array',
            allowExpression: true,
        },
        tooltip: {
            type: 'string',
            allowExpression: true,
        },
    },
    events: {},
    slots: {},
    children: {
        type: 'mixed',
        description: '通常为 Input/Select 等单个子组件',
    },
};
