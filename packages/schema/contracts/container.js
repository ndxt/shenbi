import { COMPONENT_CONTRACT_V1_VERSION, } from '../types/contract';
export const containerContract = {
    componentType: 'Container',
    runtimeType: 'shenbi.Container',
    category: 'layout',
    version: COMPONENT_CONTRACT_V1_VERSION,
    props: {
        direction: {
            type: 'enum',
            enum: ['row', 'row-reverse', 'column', 'column-reverse'],
            default: 'column',
            allowExpression: true,
            description: '主轴方向',
        },
        gap: {
            type: 'number',
            default: 0,
            allowExpression: true,
            description: '子项间距（px）',
        },
        wrap: {
            type: 'enum',
            enum: ['nowrap', 'wrap', 'wrap-reverse'],
            default: 'nowrap',
            allowExpression: true,
            description: '是否换行',
        },
        style: {
            type: 'object',
            allowExpression: true,
            description: '透传 CSSProperties',
        },
    },
    events: {},
    slots: {},
    children: {
        type: 'mixed',
        description: '容器子节点',
    },
};
export const pageEmbedContract = {
    componentType: 'PageEmbed',
    runtimeType: 'shenbi.PageEmbed',
    category: 'layout',
    version: COMPONENT_CONTRACT_V1_VERSION,
    props: {},
    events: {},
    slots: {},
    children: {
        type: 'mixed',
        description: '页面嵌入占位容器',
    },
};
