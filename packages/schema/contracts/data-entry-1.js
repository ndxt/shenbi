import { COMPONENT_CONTRACT_V1_VERSION, } from '../types/contract';
// AutoComplete
export const autoCompleteContract = {
    componentType: 'AutoComplete',
    runtimeType: 'antd.AutoComplete',
    category: 'data-entry',
    icon: 'TextSearch',
    version: COMPONENT_CONTRACT_V1_VERSION,
    props: {
        allowClear: {
            type: 'any',
            allowExpression: true,
            description: '是否显示清除按钮',
        },
        autoFocus: {
            type: 'boolean',
            default: false,
            allowExpression: true,
            description: '自动获取焦点',
        },
        backfill: {
            type: 'boolean',
            default: false,
            allowExpression: true,
            description: '使用键盘选择选项时，自动填充输入框',
        },
        defaultActiveFirstOption: {
            type: 'boolean',
            default: true,
            allowExpression: true,
            description: '是否默认高亮第一个选项',
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
            description: '是否根据输入项进行筛选',
        },
        open: {
            type: 'boolean',
            allowExpression: true,
            description: '是否展开下拉菜单',
        },
        options: {
            type: 'array',
            allowExpression: true,
            description: '数据源',
        },
        placeholder: {
            type: 'string',
            allowExpression: true,
            description: '输入框提示',
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
            description: '选中选项时的回调',
            params: [
                { name: 'value', type: 'string' },
                { name: 'option', type: 'object' },
            ],
        },
        onSearch: {
            description: '搜索补全项时的回调',
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
        onOpenChange: {
            description: '下拉菜单展开关闭的回调',
            params: [{ name: 'open', type: 'boolean' }],
        },
    },
    slots: {},
    children: {
        type: 'none',
    },
};
// Cascader
export const cascaderContract = {
    componentType: 'Cascader',
    runtimeType: 'antd.Cascader',
    category: 'data-entry',
    icon: 'ListTree',
    version: COMPONENT_CONTRACT_V1_VERSION,
    props: {
        allowClear: {
            type: 'any',
            default: true,
            allowExpression: true,
            description: '是否显示清除按钮',
        },
        autoFocus: {
            type: 'boolean',
            default: false,
            allowExpression: true,
            description: '自动获取焦点',
        },
        changeOnSelect: {
            type: 'boolean',
            default: false,
            allowExpression: true,
            description: '点选每级菜单选项值都会发生变化',
        },
        defaultValue: {
            type: 'array',
            description: '默认值',
        },
        disabled: {
            type: 'boolean',
            default: false,
            allowExpression: true,
            description: '是否禁用',
        },
        expandTrigger: {
            type: 'enum',
            enum: ['click', 'hover'],
            allowExpression: true,
            description: '次级菜单的展开方式',
        },
        fieldNames: {
            type: 'object',
            allowExpression: true,
            description: '自定义字段名',
        },
        loadData: {
            type: 'function',
            description: '用于动态加载选项',
        },
        maxTagCount: {
            type: 'any',
            allowExpression: true,
            description: '多选模式下最多显示的标签数',
        },
        multiple: {
            type: 'boolean',
            default: false,
            allowExpression: true,
            description: '是否支持多选',
        },
        open: {
            type: 'boolean',
            allowExpression: true,
            description: '是否展开下拉菜单',
        },
        options: {
            type: 'array',
            allowExpression: true,
            description: '可选项数据源',
        },
        placeholder: {
            type: 'string',
            allowExpression: true,
            description: '输入框占位文本',
        },
        showSearch: {
            type: 'any',
            allowExpression: true,
            description: '是否支持搜索',
        },
        size: {
            type: 'enum',
            enum: ['large', 'middle', 'small'],
            allowExpression: true,
            description: '输入框大小',
        },
        status: {
            type: 'enum',
            enum: ['error', 'warning'],
            allowExpression: true,
            description: '校验状态',
        },
        value: {
            type: 'array',
            allowExpression: true,
            description: '指定选中项',
        },
    },
    events: {
        onChange: {
            description: '选择完成后的回调',
            params: [
                { name: 'value', type: 'any[]' },
                { name: 'selectedOptions', type: 'any[]' },
            ],
        },
        onOpenChange: {
            description: '下拉菜单展开关闭的回调',
            params: [{ name: 'open', type: 'boolean' }],
        },
        onSearch: {
            description: '搜索时的回调',
            params: [{ name: 'value', type: 'string' }],
        },
    },
    slots: {},
    children: {
        type: 'none',
    },
};
// Checkbox
export const checkboxContract = {
    componentType: 'Checkbox',
    runtimeType: 'antd.Checkbox',
    category: 'data-entry',
    icon: 'CheckSquare',
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
        indeterminate: {
            type: 'boolean',
            default: false,
            allowExpression: true,
            description: '设置 indeterminate 状态，只负责样式控制',
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
            params: [{ name: 'e', type: 'CheckboxChangeEvent' }],
        },
    },
    slots: {},
    children: {
        type: 'text',
        description: '复选框文本',
    },
};
// Checkbox.Group
export const checkboxGroupContract = {
    componentType: 'Checkbox.Group',
    runtimeType: 'antd.Checkbox.Group',
    category: 'data-entry',
    icon: 'CheckSquare',
    version: COMPONENT_CONTRACT_V1_VERSION,
    props: {
        defaultValue: {
            type: 'array',
            description: '默认选中的选项',
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
            description: 'CheckboxGroup 下所有 input[type="checkbox"] 的 name 属性',
        },
        options: {
            type: 'array',
            allowExpression: true,
            description: '指定可选项',
        },
        value: {
            type: 'array',
            allowExpression: true,
            description: '用于设置当前选中的值',
        },
    },
    events: {
        onChange: {
            description: '变化时的回调函数',
            params: [{ name: 'checkedValue', type: 'any[]' }],
        },
    },
    slots: {},
    children: {
        type: 'none',
        description: '使用 options 配置',
    },
};
// ColorPicker
export const colorPickerContract = {
    componentType: 'ColorPicker',
    runtimeType: 'antd.ColorPicker',
    category: 'data-entry',
    icon: 'Palette',
    version: COMPONENT_CONTRACT_V1_VERSION,
    props: {
        allowClear: {
            type: 'boolean',
            default: false,
            allowExpression: true,
            description: '是否显示清除按钮',
        },
        defaultValue: {
            type: 'any',
            description: '默认颜色值',
        },
        disabled: {
            type: 'boolean',
            default: false,
            allowExpression: true,
            description: '是否禁用',
        },
        disabledAlpha: {
            type: 'boolean',
            default: false,
            allowExpression: true,
            description: '禁用透明度选择',
        },
        format: {
            type: 'enum',
            enum: ['hex', 'rgb', 'hsb'],
            allowExpression: true,
            description: '颜色格式',
        },
        open: {
            type: 'boolean',
            allowExpression: true,
            description: '是否显示弹出框',
        },
        presets: {
            type: 'array',
            allowExpression: true,
            description: '预设颜色',
        },
        showText: {
            type: 'any',
            allowExpression: true,
            description: '是否显示颜色文本',
        },
        size: {
            type: 'enum',
            enum: ['large', 'middle', 'small'],
            allowExpression: true,
            description: '设置触发器大小',
        },
        trigger: {
            type: 'enum',
            enum: ['hover', 'click'],
            default: 'click',
            allowExpression: true,
            description: '触发行为',
        },
        value: {
            type: 'any',
            allowExpression: true,
            description: '颜色值',
        },
    },
    events: {
        onChange: {
            description: '颜色变化的回调',
            params: [
                { name: 'value', type: 'any' },
                { name: 'css', type: 'string' },
            ],
        },
        onOpenChange: {
            description: '面板打开状态变化回调',
            params: [{ name: 'open', type: 'boolean' }],
        },
        onClear: {
            description: '清除时的回调',
            params: [],
        },
    },
    slots: {},
    children: {
        type: 'node',
        description: '自定义触发器',
    },
};
