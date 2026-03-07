import { COMPONENT_CONTRACT_V1_VERSION, } from '../types/contract';
// DatePicker
export const datePickerContract = {
    componentType: 'DatePicker',
    runtimeType: 'antd.DatePicker',
    category: 'data-entry',
    icon: 'Calendar',
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
        bordered: {
            type: 'boolean',
            default: true,
            allowExpression: true,
            description: '是否有边框',
        },
        disabled: {
            type: 'boolean',
            default: false,
            allowExpression: true,
            description: '是否禁用',
        },
        disabledDate: {
            type: 'function',
            description: '不可选择的日期',
        },
        format: {
            type: 'any',
            default: 'YYYY-MM-DD',
            allowExpression: true,
            description: '展示的日期格式',
        },
        open: {
            type: 'boolean',
            allowExpression: true,
            description: '控制弹层是否展开',
        },
        picker: {
            type: 'enum',
            enum: ['date', 'week', 'month', 'quarter', 'year'],
            default: 'date',
            allowExpression: true,
            description: '设置选择器类型',
        },
        placeholder: {
            type: 'string',
            allowExpression: true,
            description: '输入框提示文字',
        },
        placement: {
            type: 'enum',
            enum: ['bottomLeft', 'bottomRight', 'topLeft', 'topRight'],
            default: 'bottomLeft',
            allowExpression: true,
            description: '日期选择框弹出的位置',
        },
        showTime: {
            type: 'any',
            allowExpression: true,
            description: '增加时间选择功能',
        },
        showToday: {
            type: 'boolean',
            default: true,
            allowExpression: true,
            description: '是否展示"今天"按钮',
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
            type: 'any',
            allowExpression: true,
            description: '日期',
        },
    },
    events: {
        onChange: {
            description: '时间发生变化的回调',
            params: [
                { name: 'date', type: 'any' },
                { name: 'dateString', type: 'string' },
            ],
        },
        onOpenChange: {
            description: '弹出日历和关闭日历的回调',
            params: [{ name: 'open', type: 'boolean' }],
        },
        onPanelChange: {
            description: '日历面板切换的回调',
            params: [
                { name: 'date', type: 'any' },
                { name: 'mode', type: 'string' },
            ],
        },
    },
    slots: {},
    children: {
        type: 'none',
    },
};
// DatePicker.RangePicker
export const rangePickerContract = {
    componentType: 'DatePicker.RangePicker',
    runtimeType: 'antd.DatePicker.RangePicker',
    category: 'data-entry',
    icon: 'CalendarRange',
    version: COMPONENT_CONTRACT_V1_VERSION,
    props: {
        allowClear: {
            type: 'any',
            default: true,
            allowExpression: true,
            description: '是否显示清除按钮',
        },
        allowEmpty: {
            type: 'array',
            allowExpression: true,
            description: '允许起始项部分为空',
        },
        bordered: {
            type: 'boolean',
            default: true,
            allowExpression: true,
            description: '是否有边框',
        },
        disabled: {
            type: 'boolean',
            default: false,
            allowExpression: true,
            description: '是否禁用',
        },
        format: {
            type: 'any',
            default: 'YYYY-MM-DD',
            allowExpression: true,
            description: '展示的日期格式',
        },
        open: {
            type: 'boolean',
            allowExpression: true,
            description: '控制弹层是否展开',
        },
        picker: {
            type: 'enum',
            enum: ['date', 'week', 'month', 'quarter', 'year'],
            default: 'date',
            allowExpression: true,
            description: '设置选择器类型',
        },
        placeholder: {
            type: 'array',
            allowExpression: true,
            description: '输入框提示文字',
        },
        presets: {
            type: 'array',
            allowExpression: true,
            description: '预设范围',
        },
        showTime: {
            type: 'any',
            allowExpression: true,
            description: '增加时间选择功能',
        },
        size: {
            type: 'enum',
            enum: ['large', 'middle', 'small'],
            allowExpression: true,
            description: '输入框大小',
        },
        value: {
            type: 'array',
            allowExpression: true,
            description: '日期',
        },
    },
    events: {
        onChange: {
            description: '时间发生变化的回调',
            params: [
                { name: 'dates', type: 'any[]' },
                { name: 'dateStrings', type: 'string[]' },
            ],
        },
        onOpenChange: {
            description: '弹出日历和关闭日历的回调',
            params: [{ name: 'open', type: 'boolean' }],
        },
        onCalendarChange: {
            description: '待选日期发生变化的回调',
            params: [
                { name: 'dates', type: 'any[]' },
                { name: 'dateStrings', type: 'string[]' },
                { name: 'info', type: 'object' },
            ],
        },
    },
    slots: {},
    children: {
        type: 'none',
    },
};
// TimePicker
export const timePickerContract = {
    componentType: 'TimePicker',
    runtimeType: 'antd.TimePicker',
    category: 'data-entry',
    icon: 'Clock',
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
        bordered: {
            type: 'boolean',
            default: true,
            allowExpression: true,
            description: '是否有边框',
        },
        disabled: {
            type: 'boolean',
            default: false,
            allowExpression: true,
            description: '是否禁用',
        },
        format: {
            type: 'string',
            default: 'HH:mm:ss',
            allowExpression: true,
            description: '展示的时间格式',
        },
        hourStep: {
            type: 'number',
            allowExpression: true,
            description: '小时选项间隔',
        },
        minuteStep: {
            type: 'number',
            allowExpression: true,
            description: '分钟选项间隔',
        },
        open: {
            type: 'boolean',
            allowExpression: true,
            description: '面板是否打开',
        },
        placeholder: {
            type: 'string',
            allowExpression: true,
            description: '输入框提示文字',
        },
        secondStep: {
            type: 'number',
            allowExpression: true,
            description: '秒选项间隔',
        },
        showNow: {
            type: 'boolean',
            default: true,
            allowExpression: true,
            description: '是否展示"此刻"按钮',
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
            type: 'any',
            allowExpression: true,
            description: '当前时间',
        },
    },
    events: {
        onChange: {
            description: '时间发生变化的回调',
            params: [
                { name: 'time', type: 'any' },
                { name: 'timeString', type: 'string' },
            ],
        },
        onOpenChange: {
            description: '面板打开/关闭时的回调',
            params: [{ name: 'open', type: 'boolean' }],
        },
    },
    slots: {},
    children: {
        type: 'none',
    },
};
// InputNumber
export const inputNumberContract = {
    componentType: 'InputNumber',
    runtimeType: 'antd.InputNumber',
    category: 'data-entry',
    icon: 'Hash',
    version: COMPONENT_CONTRACT_V1_VERSION,
    props: {
        addonAfter: {
            type: 'SchemaNode',
            description: '带标签的 input，设置后置标签',
        },
        addonBefore: {
            type: 'SchemaNode',
            description: '带标签的 input，设置前置标签',
        },
        autoFocus: {
            type: 'boolean',
            default: false,
            allowExpression: true,
            description: '自动获取焦点',
        },
        bordered: {
            type: 'boolean',
            default: true,
            allowExpression: true,
            description: '是否有边框',
        },
        controls: {
            type: 'any',
            default: true,
            allowExpression: true,
            description: '是否显示增减按钮',
        },
        decimalSeparator: {
            type: 'string',
            allowExpression: true,
            description: '小数点',
        },
        defaultValue: {
            type: 'number',
            description: '默认值',
        },
        disabled: {
            type: 'boolean',
            default: false,
            allowExpression: true,
            description: '是否禁用',
        },
        formatter: {
            type: 'function',
            description: '指定输入框展示值的格式',
        },
        keyboard: {
            type: 'boolean',
            default: true,
            allowExpression: true,
            description: '是否启用键盘快捷行为',
        },
        max: {
            type: 'number',
            allowExpression: true,
            description: '最大值',
        },
        min: {
            type: 'number',
            allowExpression: true,
            description: '最小值',
        },
        parser: {
            type: 'function',
            description: '指定从 formatter 里转换回数字的方式',
        },
        placeholder: {
            type: 'string',
            allowExpression: true,
            description: '输入框提示文字',
        },
        precision: {
            type: 'number',
            allowExpression: true,
            description: '数值精度',
        },
        readOnly: {
            type: 'boolean',
            default: false,
            allowExpression: true,
            description: '是否只读',
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
        step: {
            type: 'number',
            default: 1,
            allowExpression: true,
            description: '每次改变步数',
        },
        stringMode: {
            type: 'boolean',
            default: false,
            allowExpression: true,
            description: '字符值模式',
        },
        value: {
            type: 'number',
            allowExpression: true,
            description: '当前值',
        },
    },
    events: {
        onChange: {
            description: '值变化时的回调',
            params: [{ name: 'value', type: 'number | null' }],
        },
        onPressEnter: {
            description: '按下回车的回调',
            params: [{ name: 'e', type: 'KeyboardEvent' }],
        },
        onStep: {
            description: '点击上下箭头的回调',
            params: [
                { name: 'value', type: 'number' },
                { name: 'info', type: 'object' },
            ],
        },
    },
    slots: {},
    children: {
        type: 'none',
    },
};
