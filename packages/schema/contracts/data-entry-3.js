import { COMPONENT_CONTRACT_V1_VERSION, } from '../types/contract';
// Radio
export const radioContract = {
    componentType: 'Radio',
    runtimeType: 'antd.Radio',
    category: 'data-entry',
    icon: 'CircleDot',
    version: COMPONENT_CONTRACT_V1_VERSION,
    props: {
        checked: {
            type: 'boolean',
            allowExpression: true,
            description: '指定当前是否选中',
        },
        defaultChecked: {
            type: 'boolean',
            default: false,
            description: '初始是否选中',
        },
        disabled: {
            type: 'boolean',
            default: false,
            allowExpression: true,
            description: '是否禁用',
        },
        value: {
            type: 'any',
            allowExpression: true,
            description: '根据 value 进行比较，判断是否选中',
        },
    },
    events: {
        onChange: {
            description: '变化时的回调函数',
            params: [{ name: 'e', type: 'RadioChangeEvent' }],
        },
    },
    slots: {},
    children: {
        type: 'text',
        description: '单选框文本',
    },
};
// Radio.Group
export const radioGroupContract = {
    componentType: 'Radio.Group',
    runtimeType: 'antd.Radio.Group',
    category: 'data-entry',
    icon: 'CircleDot',
    version: COMPONENT_CONTRACT_V1_VERSION,
    props: {
        buttonStyle: {
            type: 'enum',
            enum: ['outline', 'solid'],
            default: 'outline',
            allowExpression: true,
            description: 'RadioButton 的风格样式',
        },
        defaultValue: {
            type: 'any',
            description: '默认选中的值',
        },
        disabled: {
            type: 'boolean',
            default: false,
            allowExpression: true,
            description: '是否禁用',
        },
        name: {
            type: 'string',
            allowExpression: true,
            description: 'RadioGroup 下所有 input[type="radio"] 的 name 属性',
        },
        optionType: {
            type: 'enum',
            enum: ['default', 'button'],
            default: 'default',
            allowExpression: true,
            description: '用于设置 Radio options 类型',
        },
        options: {
            type: 'array',
            allowExpression: true,
            description: '以配置形式设置子元素',
        },
        size: {
            type: 'enum',
            enum: ['large', 'middle', 'small'],
            allowExpression: true,
            description: '大小',
        },
        value: {
            type: 'any',
            allowExpression: true,
            description: '用于设置当前选中的值',
        },
    },
    events: {
        onChange: {
            description: '变化时的回调函数',
            params: [{ name: 'e', type: 'RadioChangeEvent' }],
        },
    },
    slots: {},
    children: {
        type: 'nodes',
        description: 'Radio 列表',
    },
};
// Rate
export const rateContract = {
    componentType: 'Rate',
    runtimeType: 'antd.Rate',
    category: 'data-entry',
    icon: 'Star',
    version: COMPONENT_CONTRACT_V1_VERSION,
    props: {
        allowClear: {
            type: 'boolean',
            default: true,
            allowExpression: true,
            description: '是否允许再次点击后清除',
        },
        allowHalf: {
            type: 'boolean',
            default: false,
            allowExpression: true,
            description: '是否允许半选',
        },
        character: {
            type: 'SchemaNode',
            description: '自定义字符',
        },
        count: {
            type: 'number',
            default: 5,
            allowExpression: true,
            description: 'star 总数',
        },
        defaultValue: {
            type: 'number',
            default: 0,
            description: '默认值',
        },
        disabled: {
            type: 'boolean',
            default: false,
            allowExpression: true,
            description: '是否禁用',
        },
        tooltips: {
            type: 'array',
            allowExpression: true,
            description: '自定义每项的提示信息',
        },
        value: {
            type: 'number',
            allowExpression: true,
            description: '当前数',
        },
    },
    events: {
        onChange: {
            description: '选择时的回调',
            params: [{ name: 'value', type: 'number' }],
        },
        onHoverChange: {
            description: '鼠标经过时数值变化的回调',
            params: [{ name: 'value', type: 'number' }],
        },
    },
    slots: {},
    children: {
        type: 'none',
    },
};
// Slider
export const sliderContract = {
    componentType: 'Slider',
    runtimeType: 'antd.Slider',
    category: 'data-entry',
    icon: 'SlidersHorizontal',
    version: COMPONENT_CONTRACT_V1_VERSION,
    props: {
        defaultValue: {
            type: 'any',
            default: 0,
            description: '默认值',
        },
        disabled: {
            type: 'boolean',
            default: false,
            allowExpression: true,
            description: '是否禁用',
        },
        dots: {
            type: 'boolean',
            default: false,
            allowExpression: true,
            description: '是否只能拖拽到刻度上',
        },
        included: {
            type: 'boolean',
            default: true,
            allowExpression: true,
            description: '是否包含坐标轴',
        },
        marks: {
            type: 'object',
            allowExpression: true,
            description: '刻度标记',
        },
        max: {
            type: 'number',
            default: 100,
            allowExpression: true,
            description: '最大值',
        },
        min: {
            type: 'number',
            default: 0,
            allowExpression: true,
            description: '最小值',
        },
        range: {
            type: 'any',
            default: false,
            allowExpression: true,
            description: '双滑块模式',
        },
        reverse: {
            type: 'boolean',
            default: false,
            allowExpression: true,
            description: '反向坐标轴',
        },
        step: {
            type: 'number',
            default: 1,
            allowExpression: true,
            description: '步长',
        },
        tooltip: {
            type: 'object',
            allowExpression: true,
            description: '设置 Tooltip 相关属性',
        },
        value: {
            type: 'any',
            allowExpression: true,
            description: '当前值',
        },
        vertical: {
            type: 'boolean',
            default: false,
            allowExpression: true,
            description: '是否垂直方向',
        },
    },
    events: {
        onChange: {
            description: '当 Slider 的值发生改变时触发',
            params: [{ name: 'value', type: 'any' }],
        },
        onAfterChange: {
            description: '与 mouseup 触发时机一致',
            params: [{ name: 'value', type: 'any' }],
        },
    },
    slots: {},
    children: {
        type: 'none',
    },
};
// Switch
export const switchContract = {
    componentType: 'Switch',
    runtimeType: 'antd.Switch',
    category: 'data-entry',
    icon: 'ToggleLeft',
    version: COMPONENT_CONTRACT_V1_VERSION,
    props: {
        autoFocus: {
            type: 'boolean',
            default: false,
            allowExpression: true,
            description: '组件自动获取焦点',
        },
        checked: {
            type: 'boolean',
            allowExpression: true,
            description: '指定当前是否选中',
        },
        checkedChildren: {
            type: 'SchemaNode',
            description: '选中时的内容',
        },
        defaultChecked: {
            type: 'boolean',
            default: false,
            description: '初始是否选中',
        },
        disabled: {
            type: 'boolean',
            default: false,
            allowExpression: true,
            description: '是否禁用',
        },
        loading: {
            type: 'boolean',
            default: false,
            allowExpression: true,
            description: '加载中',
        },
        size: {
            type: 'enum',
            enum: ['default', 'small'],
            default: 'default',
            allowExpression: true,
            description: '开关大小',
        },
        unCheckedChildren: {
            type: 'SchemaNode',
            description: '非选中时的内容',
        },
    },
    events: {
        onChange: {
            description: '变化时的回调函数',
            params: [
                { name: 'checked', type: 'boolean' },
                { name: 'event', type: 'MouseEvent' },
            ],
        },
        onClick: {
            description: '点击时的回调函数',
            params: [
                { name: 'checked', type: 'boolean' },
                { name: 'event', type: 'MouseEvent' },
            ],
        },
    },
    slots: {},
    children: {
        type: 'none',
    },
};
// Mentions
export const mentionsContract = {
    componentType: 'Mentions',
    runtimeType: 'antd.Mentions',
    category: 'data-entry',
    icon: 'AtSign',
    version: COMPONENT_CONTRACT_V1_VERSION,
    props: {
        autoFocus: {
            type: 'boolean',
            default: false,
            allowExpression: true,
            description: '自动获取焦点',
        },
        defaultValue: {
            type: 'string',
            description: '默认值',
        },
        disabled: {
            type: 'boolean',
            default: false,
            allowExpression: true,
            description: '是否禁用',
        },
        filterOption: {
            type: 'any',
            allowExpression: true,
            description: '筛选菜单项',
        },
        notFoundContent: {
            type: 'SchemaNode',
            description: '当下拉列表为空时显示的内容',
        },
        open: {
            type: 'boolean',
            allowExpression: true,
            description: '是否展开下拉菜单',
        },
        options: {
            type: 'array',
            allowExpression: true,
            description: '下拉菜单数据',
        },
        placeholder: {
            type: 'string',
            allowExpression: true,
            description: '输入框提示',
        },
        prefix: {
            type: 'array',
            default: ['@'],
            allowExpression: true,
            description: '设置触发关键字',
        },
        split: {
            type: 'string',
            default: ' ',
            allowExpression: true,
            description: '设置选中项前后分隔符',
        },
        status: {
            type: 'enum',
            enum: ['error', 'warning'],
            allowExpression: true,
            description: '校验状态',
        },
        value: {
            type: 'string',
            allowExpression: true,
            description: '输入框的值',
        },
    },
    events: {
        onChange: {
            description: '输入框值变化时的回调',
            params: [{ name: 'value', type: 'string' }],
        },
        onSelect: {
            description: '选择下拉项时的回调',
            params: [{ name: 'option', type: 'object' }],
        },
        onSearch: {
            description: '搜索时的回调',
            params: [{ name: 'value', type: 'string' }],
        },
        onFocus: {
            description: '获得焦点时的回调',
            params: [],
        },
        onBlur: {
            description: '失去焦点时的回调',
            params: [],
        },
    },
    slots: {},
    children: {
        type: 'none',
    },
};
