import {
  COMPONENT_CONTRACT_V1_VERSION,
  type ComponentContract,
} from '../types/contract';

// ===== Chart.Line 折线图 =====
export const chartLineContract: ComponentContract = {
  componentType: 'Chart.Line',
  runtimeType: 'Chart.Line',
  category: 'chart',
  icon: 'TrendingUp',
  version: COMPONENT_CONTRACT_V1_VERSION,
  usageScenario: '展示数据连续变化趋势，适用于时间序列、月度/季度趋势分析、多指标对比折线',
  props: {
    data: {
      type: 'array',
      required: true,
      allowExpression: true,
      description: '数据源，数组对象，每项包含 xField 和 yField 对应的字段',
    },
    xField: {
      type: 'string',
      required: true,
      allowExpression: false,
      description: 'X 轴对应的数据字段名',
    },
    yField: {
      type: 'string',
      required: true,
      allowExpression: false,
      description: 'Y 轴对应的数据字段名',
    },
    colorField: {
      type: 'string',
      allowExpression: false,
      description: '颜色分组字段名，用于多折线图',
    },
    title: {
      type: 'any',
      allowExpression: true,
      description: '图表标题，支持字符串或配置对象',
    },
    height: {
      type: 'number',
      allowExpression: true,
      description: '图表高度（px），默认 300',
    },
    autoFit: {
      type: 'boolean',
      default: true,
      allowExpression: true,
      description: '是否自适应容器宽度',
    },
    legend: {
      type: 'any',
      allowExpression: true,
      description: '图例配置，false 隐藏图例',
    },
    tooltip: {
      type: 'any',
      allowExpression: true,
      description: '提示信息配置',
    },
    label: {
      type: 'any',
      allowExpression: true,
      description: '数据标签配置',
    },
    axis: {
      type: 'any',
      allowExpression: true,
      description: '坐标轴配置对象',
    },
    style: {
      type: 'any',
      allowExpression: true,
      description: '图形绘制属性，如线条颜色、宽度等',
    },
    theme: {
      type: 'string',
      allowExpression: true,
      description: '主题，支持 "light" / "dark"',
    },
    slider: {
      type: 'any',
      allowExpression: true,
      description: '缩略轴配置',
    },
    scrollbar: {
      type: 'any',
      allowExpression: true,
      description: '滚动条配置',
    },
  },
  events: {
    onReady: {
      description: '图表渲染完成的回调',
      params: [{ name: 'chart', type: 'Chart' }],
    },
  },
  slots: {},
  children: {
    type: 'none',
  },
};

// ===== Chart.Column 柱状图 =====
export const chartColumnContract: ComponentContract = {
  componentType: 'Chart.Column',
  runtimeType: 'Chart.Column',
  category: 'chart',
  icon: 'BarChart2',
  version: COMPONENT_CONTRACT_V1_VERSION,
  usageScenario: '展示各类别之间的数据对比，适用于月度销售额、部门人数、品类排行等场景',
  props: {
    data: {
      type: 'array',
      required: true,
      allowExpression: true,
      description: '数据源，数组对象，每项包含 xField 和 yField 对应的字段',
    },
    xField: {
      type: 'string',
      required: true,
      allowExpression: false,
      description: 'X 轴分类字段名',
    },
    yField: {
      type: 'string',
      required: true,
      allowExpression: false,
      description: 'Y 轴数值字段名',
    },
    colorField: {
      type: 'string',
      allowExpression: false,
      description: '颜色分组字段，用于分组/堆叠柱状图',
    },
    title: {
      type: 'any',
      allowExpression: true,
      description: '图表标题',
    },
    height: {
      type: 'number',
      allowExpression: true,
      description: '图表高度（px），默认 300',
    },
    autoFit: {
      type: 'boolean',
      default: true,
      allowExpression: true,
      description: '是否自适应容器宽度',
    },
    stack: {
      type: 'any',
      allowExpression: true,
      description: '堆叠配置，true 开启堆叠',
    },
    group: {
      type: 'any',
      allowExpression: true,
      description: '分组配置，true 开启分组',
    },
    legend: {
      type: 'any',
      allowExpression: true,
      description: '图例配置',
    },
    tooltip: {
      type: 'any',
      allowExpression: true,
      description: '提示信息配置',
    },
    label: {
      type: 'any',
      allowExpression: true,
      description: '柱子上的数据标签',
    },
    axis: {
      type: 'any',
      allowExpression: true,
      description: '坐标轴配置',
    },
    style: {
      type: 'any',
      allowExpression: true,
      description: '柱子绘制属性',
    },
    theme: {
      type: 'string',
      allowExpression: true,
      description: '主题，"light" / "dark"',
    },
  },
  events: {
    onReady: {
      description: '图表渲染完成的回调',
      params: [{ name: 'chart', type: 'Chart' }],
    },
  },
  slots: {},
  children: {
    type: 'none',
  },
};

// ===== Chart.Bar 条形图 =====
export const chartBarContract: ComponentContract = {
  componentType: 'Chart.Bar',
  runtimeType: 'Chart.Bar',
  category: 'chart',
  icon: 'AlignLeft',
  version: COMPONENT_CONTRACT_V1_VERSION,
  usageScenario: '水平方向柱状图，适用于类别名称较长、排行榜、横向对比场景',
  props: {
    data: {
      type: 'array',
      required: true,
      allowExpression: true,
      description: '数据源',
    },
    xField: {
      type: 'string',
      required: true,
      allowExpression: false,
      description: '数值字段名（水平轴）',
    },
    yField: {
      type: 'string',
      required: true,
      allowExpression: false,
      description: '分类字段名（垂直轴）',
    },
    colorField: {
      type: 'string',
      allowExpression: false,
      description: '颜色分组字段',
    },
    title: {
      type: 'any',
      allowExpression: true,
      description: '图表标题',
    },
    height: {
      type: 'number',
      allowExpression: true,
      description: '图表高度（px），默认 300',
    },
    autoFit: {
      type: 'boolean',
      default: true,
      allowExpression: true,
      description: '是否自适应容器宽度',
    },
    stack: {
      type: 'any',
      allowExpression: true,
      description: '堆叠配置',
    },
    group: {
      type: 'any',
      allowExpression: true,
      description: '分组配置',
    },
    legend: {
      type: 'any',
      allowExpression: true,
      description: '图例配置',
    },
    tooltip: {
      type: 'any',
      allowExpression: true,
      description: '提示信息配置',
    },
    label: {
      type: 'any',
      allowExpression: true,
      description: '数据标签',
    },
    style: {
      type: 'any',
      allowExpression: true,
      description: '图形绘制属性',
    },
    theme: {
      type: 'string',
      allowExpression: true,
      description: '主题，"light" / "dark"',
    },
  },
  events: {
    onReady: {
      description: '图表渲染完成的回调',
      params: [{ name: 'chart', type: 'Chart' }],
    },
  },
  slots: {},
  children: {
    type: 'none',
  },
};

// ===== Chart.Area 面积图 =====
export const chartAreaContract: ComponentContract = {
  componentType: 'Chart.Area',
  runtimeType: 'Chart.Area',
  category: 'chart',
  icon: 'AreaChart',
  version: COMPONENT_CONTRACT_V1_VERSION,
  usageScenario: '折线与坐标轴之间区域着色，强调累计总量与趋势变化，适用于流量、销售额趋势展示',
  props: {
    data: {
      type: 'array',
      required: true,
      allowExpression: true,
      description: '数据源',
    },
    xField: {
      type: 'string',
      required: true,
      allowExpression: false,
      description: 'X 轴字段名',
    },
    yField: {
      type: 'string',
      required: true,
      allowExpression: false,
      description: 'Y 轴字段名',
    },
    colorField: {
      type: 'string',
      allowExpression: false,
      description: '颜色分组字段，用于多面积图',
    },
    stack: {
      type: 'any',
      allowExpression: true,
      description: '堆叠配置，true 开启堆叠面积图',
    },
    title: {
      type: 'any',
      allowExpression: true,
      description: '图表标题',
    },
    height: {
      type: 'number',
      allowExpression: true,
      description: '图表高度（px），默认 300',
    },
    autoFit: {
      type: 'boolean',
      default: true,
      allowExpression: true,
      description: '是否自适应容器宽度',
    },
    legend: {
      type: 'any',
      allowExpression: true,
      description: '图例配置',
    },
    tooltip: {
      type: 'any',
      allowExpression: true,
      description: '提示信息配置',
    },
    label: {
      type: 'any',
      allowExpression: true,
      description: '数据标签',
    },
    axis: {
      type: 'any',
      allowExpression: true,
      description: '坐标轴配置',
    },
    style: {
      type: 'any',
      allowExpression: true,
      description: '图形绘制属性',
    },
    theme: {
      type: 'string',
      allowExpression: true,
      description: '主题，"light" / "dark"',
    },
    slider: {
      type: 'any',
      allowExpression: true,
      description: '缩略轴',
    },
  },
  events: {
    onReady: {
      description: '图表渲染完成的回调',
      params: [{ name: 'chart', type: 'Chart' }],
    },
  },
  slots: {},
  children: {
    type: 'none',
  },
};

// ===== Chart.Pie 饼图 =====
export const chartPieContract: ComponentContract = {
  componentType: 'Chart.Pie',
  runtimeType: 'Chart.Pie',
  category: 'chart',
  icon: 'PieChart',
  version: COMPONENT_CONTRACT_V1_VERSION,
  usageScenario: '展示各部分占总体的比例关系，适用于部门占比、类别分布、资源分配等场景；innerRadius >0 时变为环图',
  props: {
    data: {
      type: 'array',
      required: true,
      allowExpression: true,
      description: '数据源，每项包含 angleField 和 colorField 对应的字段',
    },
    angleField: {
      type: 'string',
      required: true,
      allowExpression: false,
      description: '角度（数值）字段名，决定各扇形大小',
    },
    colorField: {
      type: 'string',
      required: true,
      allowExpression: false,
      description: '颜色/分类字段名，区分各扇形',
    },
    innerRadius: {
      type: 'number',
      allowExpression: true,
      description: '内半径（0-1），大于 0 时变为环形图（donut）',
    },
    title: {
      type: 'any',
      allowExpression: true,
      description: '图表标题',
    },
    height: {
      type: 'number',
      allowExpression: true,
      description: '图表高度（px），默认 300',
    },
    autoFit: {
      type: 'boolean',
      default: true,
      allowExpression: true,
      description: '是否自适应容器宽度',
    },
    legend: {
      type: 'any',
      allowExpression: true,
      description: '图例配置',
    },
    tooltip: {
      type: 'any',
      allowExpression: true,
      description: '提示信息配置',
    },
    label: {
      type: 'any',
      allowExpression: true,
      description: '数据标签（扇形上的文字）',
    },
    style: {
      type: 'any',
      allowExpression: true,
      description: '扇形绘制属性',
    },
    theme: {
      type: 'string',
      allowExpression: true,
      description: '主题，"light" / "dark"',
    },
  },
  events: {
    onReady: {
      description: '图表渲染完成的回调',
      params: [{ name: 'chart', type: 'Chart' }],
    },
  },
  slots: {},
  children: {
    type: 'none',
  },
};

// ===== Chart.Gauge 仪表盘 =====
export const chartGaugeContract: ComponentContract = {
  componentType: 'Chart.Gauge',
  runtimeType: 'Chart.Gauge',
  category: 'chart',
  icon: 'Gauge',
  version: COMPONENT_CONTRACT_V1_VERSION,
  usageScenario: '展示单一指标的达成进度或比率，适用于 KPI 完成率、系统使用率、业务目标进度等场景',
  props: {
    data: {
      type: 'object',
      required: true,
      allowExpression: true,
      description: '数据对象，格式：{ target: number, total: number, percent?: number, thresholds?: number[] }',
    },
    title: {
      type: 'any',
      allowExpression: true,
      description: '图表标题',
    },
    height: {
      type: 'number',
      allowExpression: true,
      description: '图表高度（px），默认 300',
    },
    autoFit: {
      type: 'boolean',
      default: true,
      allowExpression: true,
      description: '是否自适应容器宽度',
    },
    legend: {
      type: 'any',
      allowExpression: true,
      description: '图例配置',
    },
    tooltip: {
      type: 'any',
      allowExpression: true,
      description: '提示信息配置',
    },
    label: {
      type: 'any',
      allowExpression: true,
      description: '标签配置',
    },
    style: {
      type: 'any',
      allowExpression: true,
      description: '样式配置，支持 arc/pin/pointer/text 前缀属性',
    },
    theme: {
      type: 'string',
      allowExpression: true,
      description: '主题，"light" / "dark"',
    },
  },
  events: {
    onReady: {
      description: '图表渲染完成的回调',
      params: [{ name: 'chart', type: 'Chart' }],
    },
  },
  slots: {},
  children: {
    type: 'none',
  },
};
