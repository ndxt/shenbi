// ---------------------------------------------------------------------------
// Gateway Node Contracts — unified ComponentContract definitions
// ---------------------------------------------------------------------------

import {
  type ComponentContract,
  type PortDataType,
  COMPONENT_CONTRACT_V1_VERSION,
} from '../types/contract';

/** Port data type display colors */
export const PORT_TYPE_COLORS: Record<PortDataType, string> = {
  any: '#94a3b8',
  string: '#22c55e',
  number: '#3b82f6',
  boolean: '#f59e0b',
  object: '#8b5cf6',
  array: '#ec4899',
  void: '#6b7280',
};

/** All gateway node component types */
export type GatewayComponentType =
  | 'Gateway.Start'
  | 'Gateway.End'
  | 'Gateway.DataDefinition'
  | 'Gateway.Metadata'
  | 'Gateway.SqlQuery'
  | 'Gateway.Branch'
  | 'Gateway.LoopStart'
  | 'Gateway.LoopEnd'
  | 'Gateway.LoopBreak'
  | 'Gateway.LoopContinue'
  // Database
  | 'Gateway.Query'
  | 'Gateway.Update'
  | 'Gateway.SqlRun'
  | 'Gateway.SqlWrite'
  | 'Gateway.Commit'
  // HTTP / Module
  | 'Gateway.Http'
  | 'Gateway.CallModule'
  // Data processing
  | 'Gateway.DefineData'
  | 'Gateway.Map'
  | 'Gateway.Filter'
  | 'Gateway.Append'
  | 'Gateway.Desensitize'
  | 'Gateway.Assignment'
  | 'Gateway.Check'
  | 'Gateway.Stat'
  | 'Gateway.InterLine'
  | 'Gateway.CrossTable'
  | 'Gateway.Sort'
  | 'Gateway.SortAsTree'
  | 'Gateway.ToTree'
  | 'Gateway.Join'
  | 'Gateway.Union'
  | 'Gateway.Intersect'
  | 'Gateway.Minus'
  | 'Gateway.Compare'
  | 'Gateway.Script'
  | 'Gateway.Encrypt'
  | 'Gateway.Decipher'
  | 'Gateway.Signature'
  // ES / Redis
  | 'Gateway.EsQuery'
  | 'Gateway.EsWrite'
  | 'Gateway.RedisRead'
  | 'Gateway.RedisWrite'
  // File
  | 'Gateway.ExcelIn'
  | 'Gateway.ExcelOut'
  | 'Gateway.Zip'
  | 'Gateway.Report'
  | 'Gateway.MarkShade'
  | 'Gateway.QrCode'
  | 'Gateway.FileLoad'
  | 'Gateway.FileSave'
  | 'Gateway.FileDelete'
  | 'Gateway.FileAuth'
  | 'Gateway.ChartImage'
  | 'Gateway.ToPdf'
  | 'Gateway.FtpUpload'
  | 'Gateway.FtpDownload'
  | 'Gateway.FileCheck'
  | 'Gateway.FileMerge'
  | 'Gateway.CsvRead'
  | 'Gateway.CsvWrite'
  | 'Gateway.ObjRead'
  | 'Gateway.ObjWrite'
  | 'Gateway.SqliteOut'
  | 'Gateway.SqliteIn'
  // Workflow
  | 'Gateway.CreateFlow'
  | 'Gateway.SubmitFlow'
  | 'Gateway.TaskList'
  | 'Gateway.TaskManager'
  | 'Gateway.FlowRuntime'
  | 'Gateway.FlowStatus'
  | 'Gateway.FlowDispatch'
  // System
  | 'Gateway.UnitFilter'
  | 'Gateway.UserFilter'
  | 'Gateway.UserManager'
  | 'Gateway.UnitManager'
  | 'Gateway.UserRoleM'
  | 'Gateway.UserUnitM'
  | 'Gateway.UserRoleQ'
  | 'Gateway.UserUnitQ'
  | 'Gateway.Dictionary'
  | 'Gateway.Notice'
  | 'Gateway.LogWrite'
  | 'Gateway.LogQuery'
  | 'Gateway.SerialNumber'
  | 'Gateway.SessionData'
  | 'Gateway.WorkCalendar';

/**
 * Maps a GatewayNodeKind (used in React Flow runtime) to the unified
 * componentType string used in the contract registry.
 */
export const GATEWAY_KIND_TO_COMPONENT_TYPE: Record<string, GatewayComponentType> = {
  'start': 'Gateway.Start',
  'end': 'Gateway.End',
  'data-definition': 'Gateway.DataDefinition',
  'metadata': 'Gateway.Metadata',
  'sql-query': 'Gateway.SqlQuery',
  'branch': 'Gateway.Branch',
  'loop-start': 'Gateway.LoopStart',
  'loop-end': 'Gateway.LoopEnd',
  'loop-break': 'Gateway.LoopBreak',
  'loop-continue': 'Gateway.LoopContinue',
  // Database
  'query': 'Gateway.Query',
  'update': 'Gateway.Update',
  'sql-run': 'Gateway.SqlRun',
  'sql-write': 'Gateway.SqlWrite',
  'commit': 'Gateway.Commit',
  // HTTP / Module
  'http': 'Gateway.Http',
  'call-module': 'Gateway.CallModule',
  // Data processing
  'define-data': 'Gateway.DefineData',
  'map': 'Gateway.Map',
  'filter': 'Gateway.Filter',
  'append': 'Gateway.Append',
  'desensitize': 'Gateway.Desensitize',
  'assignment': 'Gateway.Assignment',
  'check': 'Gateway.Check',
  'stat': 'Gateway.Stat',
  'inter-line': 'Gateway.InterLine',
  'cross-table': 'Gateway.CrossTable',
  'sort': 'Gateway.Sort',
  'sort-as-tree': 'Gateway.SortAsTree',
  'to-tree': 'Gateway.ToTree',
  'join': 'Gateway.Join',
  'union': 'Gateway.Union',
  'intersect': 'Gateway.Intersect',
  'minus': 'Gateway.Minus',
  'compare': 'Gateway.Compare',
  'script': 'Gateway.Script',
  'encrypt': 'Gateway.Encrypt',
  'decipher': 'Gateway.Decipher',
  'signature': 'Gateway.Signature',
  // ES / Redis
  'es-query': 'Gateway.EsQuery',
  'es-write': 'Gateway.EsWrite',
  'redis-read': 'Gateway.RedisRead',
  'redis-write': 'Gateway.RedisWrite',
  // File
  'excel-in': 'Gateway.ExcelIn',
  'excel-out': 'Gateway.ExcelOut',
  'zip': 'Gateway.Zip',
  'report': 'Gateway.Report',
  'mark-shade': 'Gateway.MarkShade',
  'qr-code': 'Gateway.QrCode',
  'file-load': 'Gateway.FileLoad',
  'file-save': 'Gateway.FileSave',
  'file-delete': 'Gateway.FileDelete',
  'file-auth': 'Gateway.FileAuth',
  'chart-image': 'Gateway.ChartImage',
  'to-pdf': 'Gateway.ToPdf',
  'ftp-upload': 'Gateway.FtpUpload',
  'ftp-download': 'Gateway.FtpDownload',
  'file-check': 'Gateway.FileCheck',
  'file-merge': 'Gateway.FileMerge',
  'csv-read': 'Gateway.CsvRead',
  'csv-write': 'Gateway.CsvWrite',
  'obj-read': 'Gateway.ObjRead',
  'obj-write': 'Gateway.ObjWrite',
  'sqlite-out': 'Gateway.SqliteOut',
  'sqlite-in': 'Gateway.SqliteIn',
  // Workflow
  'create-flow': 'Gateway.CreateFlow',
  'submit-flow': 'Gateway.SubmitFlow',
  'task-list': 'Gateway.TaskList',
  'task-manager': 'Gateway.TaskManager',
  'flow-runtime': 'Gateway.FlowRuntime',
  'flow-status': 'Gateway.FlowStatus',
  'flow-dispatch': 'Gateway.FlowDispatch',
  // System
  'unit-filter': 'Gateway.UnitFilter',
  'user-filter': 'Gateway.UserFilter',
  'user-manager': 'Gateway.UserManager',
  'unit-manager': 'Gateway.UnitManager',
  'user-role-m': 'Gateway.UserRoleM',
  'user-unit-m': 'Gateway.UserUnitM',
  'user-role-q': 'Gateway.UserRoleQ',
  'user-unit-q': 'Gateway.UserUnitQ',
  'dictionary': 'Gateway.Dictionary',
  'notice': 'Gateway.Notice',
  'log-write': 'Gateway.LogWrite',
  'log-query': 'Gateway.LogQuery',
  'serial-number': 'Gateway.SerialNumber',
  'session-data': 'Gateway.SessionData',
  'work-calendar': 'Gateway.WorkCalendar',
};

/** Reverse map: componentType → kind */
export const GATEWAY_COMPONENT_TYPE_TO_KIND: Record<GatewayComponentType, string> = {
  'Gateway.Start': 'start',
  'Gateway.End': 'end',
  'Gateway.DataDefinition': 'data-definition',
  'Gateway.Metadata': 'metadata',
  'Gateway.SqlQuery': 'sql-query',
  'Gateway.Branch': 'branch',
  'Gateway.LoopStart': 'loop-start',
  'Gateway.LoopEnd': 'loop-end',
  'Gateway.LoopBreak': 'loop-break',
  'Gateway.LoopContinue': 'loop-continue',
  // Database
  'Gateway.Query': 'query',
  'Gateway.Update': 'update',
  'Gateway.SqlRun': 'sql-run',
  'Gateway.SqlWrite': 'sql-write',
  'Gateway.Commit': 'commit',
  // HTTP / Module
  'Gateway.Http': 'http',
  'Gateway.CallModule': 'call-module',
  // Data processing
  'Gateway.DefineData': 'define-data',
  'Gateway.Map': 'map',
  'Gateway.Filter': 'filter',
  'Gateway.Append': 'append',
  'Gateway.Desensitize': 'desensitize',
  'Gateway.Assignment': 'assignment',
  'Gateway.Check': 'check',
  'Gateway.Stat': 'stat',
  'Gateway.InterLine': 'inter-line',
  'Gateway.CrossTable': 'cross-table',
  'Gateway.Sort': 'sort',
  'Gateway.SortAsTree': 'sort-as-tree',
  'Gateway.ToTree': 'to-tree',
  'Gateway.Join': 'join',
  'Gateway.Union': 'union',
  'Gateway.Intersect': 'intersect',
  'Gateway.Minus': 'minus',
  'Gateway.Compare': 'compare',
  'Gateway.Script': 'script',
  'Gateway.Encrypt': 'encrypt',
  'Gateway.Decipher': 'decipher',
  'Gateway.Signature': 'signature',
  // ES / Redis
  'Gateway.EsQuery': 'es-query',
  'Gateway.EsWrite': 'es-write',
  'Gateway.RedisRead': 'redis-read',
  'Gateway.RedisWrite': 'redis-write',
  // File
  'Gateway.ExcelIn': 'excel-in',
  'Gateway.ExcelOut': 'excel-out',
  'Gateway.Zip': 'zip',
  'Gateway.Report': 'report',
  'Gateway.MarkShade': 'mark-shade',
  'Gateway.QrCode': 'qr-code',
  'Gateway.FileLoad': 'file-load',
  'Gateway.FileSave': 'file-save',
  'Gateway.FileDelete': 'file-delete',
  'Gateway.FileAuth': 'file-auth',
  'Gateway.ChartImage': 'chart-image',
  'Gateway.ToPdf': 'to-pdf',
  'Gateway.FtpUpload': 'ftp-upload',
  'Gateway.FtpDownload': 'ftp-download',
  'Gateway.FileCheck': 'file-check',
  'Gateway.FileMerge': 'file-merge',
  'Gateway.CsvRead': 'csv-read',
  'Gateway.CsvWrite': 'csv-write',
  'Gateway.ObjRead': 'obj-read',
  'Gateway.ObjWrite': 'obj-write',
  'Gateway.SqliteOut': 'sqlite-out',
  'Gateway.SqliteIn': 'sqlite-in',
  // Workflow
  'Gateway.CreateFlow': 'create-flow',
  'Gateway.SubmitFlow': 'submit-flow',
  'Gateway.TaskList': 'task-list',
  'Gateway.TaskManager': 'task-manager',
  'Gateway.FlowRuntime': 'flow-runtime',
  'Gateway.FlowStatus': 'flow-status',
  'Gateway.FlowDispatch': 'flow-dispatch',
  // System
  'Gateway.UnitFilter': 'unit-filter',
  'Gateway.UserFilter': 'user-filter',
  'Gateway.UserManager': 'user-manager',
  'Gateway.UnitManager': 'unit-manager',
  'Gateway.UserRoleM': 'user-role-m',
  'Gateway.UserUnitM': 'user-unit-m',
  'Gateway.UserRoleQ': 'user-role-q',
  'Gateway.UserUnitQ': 'user-unit-q',
  'Gateway.Dictionary': 'dictionary',
  'Gateway.Notice': 'notice',
  'Gateway.LogWrite': 'log-write',
  'Gateway.LogQuery': 'log-query',
  'Gateway.SerialNumber': 'serial-number',
  'Gateway.SessionData': 'session-data',
  'Gateway.WorkCalendar': 'work-calendar',
};

// ---------------------------------------------------------------------------
// Contract definitions
// ---------------------------------------------------------------------------

const startContract: ComponentContract = {
  componentType: 'Gateway.Start',
  displayNameKey: '开始',
  category: 'gateway-endpoints',
  icon: 'Play',
  color: '#10b981',
  description: 'API 入口节点，接收请求参数',
  version: COMPONENT_CONTRACT_V1_VERSION,
  maxInstances: 1,
  ports: {
    inputs: [],
    outputs: [
      { id: 'request', label: '请求参数', dataType: 'object' },
    ],
  },
};

const endContract: ComponentContract = {
  componentType: 'Gateway.End',
  displayNameKey: '返回结果',
  category: 'gateway-endpoints',
  icon: 'Square',
  color: '#ef4444',
  description: 'API 出口节点，返回执行结果',
  version: COMPONENT_CONTRACT_V1_VERSION,
  ports: {
    inputs: [
      { id: 'result', label: '返回值', dataType: 'any' },
    ],
    outputs: [],
  },
};

const dataDefinitionContract: ComponentContract = {
  componentType: 'Gateway.DataDefinition',
  displayNameKey: '数据定义',
  category: 'gateway-data',
  icon: 'Variable',
  color: '#a855f7',
  description: '定义变量、常量或数据转换',
  version: COMPONENT_CONTRACT_V1_VERSION,
  ports: {
    inputs: [
      { id: 'input', label: '输入', dataType: 'any' },
    ],
    outputs: [
      { id: 'output', label: '输出', dataType: 'object' },
    ],
  },
};

const metadataContract: ComponentContract = {
  componentType: 'Gateway.Metadata',
  displayNameKey: '元数据',
  category: 'gateway-data',
  icon: 'FileJson',
  color: '#06b6d4',
  description: '定义元数据信息',
  version: COMPONENT_CONTRACT_V1_VERSION,
  ports: {
    inputs: [],
    outputs: [
      { id: 'metadata', label: '元数据', dataType: 'object' },
    ],
  },
};

const sqlQueryContract: ComponentContract = {
  componentType: 'Gateway.SqlQuery',
  displayNameKey: 'SQL 查询',
  category: 'gateway-data',
  icon: 'Database',
  color: '#f59e0b',
  description: '执行 SQL 查询语句',
  version: COMPONENT_CONTRACT_V1_VERSION,
  ports: {
    inputs: [
      { id: 'params', label: '查询参数', dataType: 'object' },
    ],
    outputs: [
      { id: 'rows', label: '结果集', dataType: 'array' },
    ],
  },
};

const branchContract: ComponentContract = {
  componentType: 'Gateway.Branch',
  displayNameKey: '条件分支',
  category: 'gateway-flow',
  icon: 'GitBranch',
  color: '#ec4899',
  description: '根据条件走不同路径',
  version: COMPONENT_CONTRACT_V1_VERSION,
  ports: {
    inputs: [
      { id: 'condition', label: '条件', dataType: 'any' },
    ],
    outputs: [
      { id: 'true', label: '是', dataType: 'any' },
      { id: 'false', label: '否', dataType: 'any' },
    ],
  },
};

const loopStartContract: ComponentContract = {
  componentType: 'Gateway.LoopStart',
  displayNameKey: '开始循环',
  category: 'gateway-flow',
  icon: 'Play',
  color: '#14b8a6',
  description: '开始遍历数组或集合，并把当前项送入循环体',
  version: COMPONENT_CONTRACT_V1_VERSION,
  ports: {
    inputs: [
      { id: 'items', label: '数据集', dataType: 'array' },
    ],
    outputs: [
      { id: 'item', label: '当前项', dataType: 'any' },
    ],
  },
};

const loopEndContract: ComponentContract = {
  componentType: 'Gateway.LoopEnd',
  displayNameKey: '结束循环',
  category: 'gateway-flow',
  icon: 'Square',
  color: '#0f766e',
  description: '结束当前循环体并输出汇总结果',
  version: COMPONENT_CONTRACT_V1_VERSION,
  ports: {
    inputs: [
      { id: 'input', label: '输入', dataType: 'any' },
    ],
    outputs: [
      { id: 'output', label: '输出', dataType: 'any' },
    ],
  },
};

const loopBreakContract: ComponentContract = {
  componentType: 'Gateway.LoopBreak',
  displayNameKey: '跳出循环',
  category: 'gateway-flow',
  icon: 'LogOut',
  color: '#0f766e',
  description: '提前结束循环并跳到循环外继续执行',
  version: COMPONENT_CONTRACT_V1_VERSION,
  ports: {
    inputs: [
      { id: 'input', label: '输入', dataType: 'any' },
    ],
    outputs: [
      { id: 'output', label: '输出', dataType: 'any' },
    ],
  },
};

const loopContinueContract: ComponentContract = {
  componentType: 'Gateway.LoopContinue',
  displayNameKey: '继续循环',
  category: 'gateway-flow',
  icon: 'SkipForward',
  color: '#0f766e',
  description: '跳过当前剩余步骤，直接进入下一次循环',
  version: COMPONENT_CONTRACT_V1_VERSION,
  ports: {
    inputs: [
      { id: 'input', label: '输入', dataType: 'any' },
    ],
    outputs: [
      { id: 'output', label: '输出', dataType: 'any' },
    ],
  },
};

// ---------------------------------------------------------------------------
// Database contracts
// ---------------------------------------------------------------------------

const queryContract: ComponentContract = {
  componentType: 'Gateway.Query',
  displayNameKey: '元数据查询',
  category: 'gateway-database',
  icon: 'Search',
  color: '#f59e0b',
  description: '根据元数据对象查询，支持单个对象查询和列表查询',
  version: COMPONENT_CONTRACT_V1_VERSION,
  ports: {
    inputs: [{ id: 'params', label: '查询参数', dataType: 'object' }],
    outputs: [{ id: 'result', label: '查询结果', dataType: 'any' }],
  },
};

const updateContract: ComponentContract = {
  componentType: 'Gateway.Update',
  displayNameKey: '元数据更新',
  category: 'gateway-database',
  icon: 'PenLine',
  color: '#f59e0b',
  description: '根据元数据中的表结构自动更新数据库，支持级联更新',
  version: COMPONENT_CONTRACT_V1_VERSION,
  ports: {
    inputs: [{ id: 'data', label: '数据', dataType: 'object' }],
    outputs: [{ id: 'result', label: '更新结果', dataType: 'object' }],
  },
};

const sqlRunContract: ComponentContract = {
  componentType: 'Gateway.SqlRun',
  displayNameKey: 'SQL 执行',
  category: 'gateway-database',
  icon: 'Play',
  color: '#f59e0b',
  description: '执行 update、insert、delete 或存储过程调用',
  version: COMPONENT_CONTRACT_V1_VERSION,
  ports: {
    inputs: [{ id: 'params', label: '参数', dataType: 'object' }],
    outputs: [{ id: 'result', label: '执行结果', dataType: 'object' }],
  },
};

const sqlWriteContract: ComponentContract = {
  componentType: 'Gateway.SqlWrite',
  displayNameKey: 'SQL 写入',
  category: 'gateway-database',
  icon: 'DatabaseZap',
  color: '#f59e0b',
  description: '将指定的数据写入到关系型数据库的特定表中',
  version: COMPONENT_CONTRACT_V1_VERSION,
  ports: {
    inputs: [{ id: 'data', label: '数据', dataType: 'array' }],
    outputs: [{ id: 'result', label: '写入结果', dataType: 'object' }],
  },
};

const commitContract: ComponentContract = {
  componentType: 'Gateway.Commit',
  displayNameKey: '事务提交',
  category: 'gateway-database',
  icon: 'CheckCircle',
  color: '#f59e0b',
  description: '手动事务操作，支持提交或回滚数据库操作',
  version: COMPONENT_CONTRACT_V1_VERSION,
  ports: {
    inputs: [{ id: 'input', label: '输入', dataType: 'any' }],
    outputs: [{ id: 'output', label: '输出', dataType: 'any' }],
  },
};

// ---------------------------------------------------------------------------
// HTTP / Module contracts
// ---------------------------------------------------------------------------

const httpContract: ComponentContract = {
  componentType: 'Gateway.Http',
  displayNameKey: 'HTTP 请求',
  category: 'gateway-http',
  icon: 'Globe',
  color: '#3b82f6',
  description: '调用第三方 HTTP(S) REST 服务',
  version: COMPONENT_CONTRACT_V1_VERSION,
  ports: {
    inputs: [{ id: 'request', label: '请求参数', dataType: 'object' }],
    outputs: [{ id: 'response', label: '响应结果', dataType: 'object' }],
  },
};

const callModuleContract: ComponentContract = {
  componentType: 'Gateway.CallModule',
  displayNameKey: '调用模块',
  category: 'gateway-http',
  icon: 'Blocks',
  color: '#3b82f6',
  description: '调用指定子 API 并返回结果数据集',
  version: COMPONENT_CONTRACT_V1_VERSION,
  ports: {
    inputs: [{ id: 'params', label: '调用参数', dataType: 'object' }],
    outputs: [{ id: 'result', label: '返回结果', dataType: 'any' }],
  },
};

// ---------------------------------------------------------------------------
// Data processing contracts
// ---------------------------------------------------------------------------

const defineDataContract: ComponentContract = {
  componentType: 'Gateway.DefineData',
  displayNameKey: '定义数据',
  category: 'gateway-data-proc',
  icon: 'FileCode',
  color: '#a855f7',
  description: '根据描述语言生成一个新的数据集',
  version: COMPONENT_CONTRACT_V1_VERSION,
  ports: {
    inputs: [],
    outputs: [{ id: 'output', label: '数据集', dataType: 'object' }],
  },
};

const mapContract: ComponentContract = {
  componentType: 'Gateway.Map',
  displayNameKey: '字段映射',
  category: 'gateway-data-proc',
  icon: 'ArrowLeftRight',
  color: '#a855f7',
  description: '将数据集中的内容通过表达式映射生成新的数据集',
  version: COMPONENT_CONTRACT_V1_VERSION,
  ports: {
    inputs: [{ id: 'input', label: '输入', dataType: 'array' }],
    outputs: [{ id: 'output', label: '输出', dataType: 'array' }],
  },
};

const filterContract: ComponentContract = {
  componentType: 'Gateway.Filter',
  displayNameKey: '数据筛选',
  category: 'gateway-data-proc',
  icon: 'Filter',
  color: '#a855f7',
  description: '通过对指定数据集的数据筛选，生成新的数据集',
  version: COMPONENT_CONTRACT_V1_VERSION,
  ports: {
    inputs: [{ id: 'input', label: '输入', dataType: 'array' }],
    outputs: [{ id: 'output', label: '输出', dataType: 'array' }],
  },
};

const appendContract: ComponentContract = {
  componentType: 'Gateway.Append',
  displayNameKey: '添加字段',
  category: 'gateway-data-proc',
  icon: 'PlusSquare',
  color: '#a855f7',
  description: '在指定的数据集中添加新的属性或修改属性',
  version: COMPONENT_CONTRACT_V1_VERSION,
  ports: {
    inputs: [{ id: 'input', label: '输入', dataType: 'array' }],
    outputs: [{ id: 'output', label: '输出', dataType: 'array' }],
  },
};

const desensitizeContract: ComponentContract = {
  componentType: 'Gateway.Desensitize',
  displayNameKey: '数据脱敏',
  category: 'gateway-data-proc',
  icon: 'EyeOff',
  color: '#a855f7',
  description: '对数据中的敏感数据进行脱敏操作',
  version: COMPONENT_CONTRACT_V1_VERSION,
  ports: {
    inputs: [{ id: 'input', label: '输入', dataType: 'array' }],
    outputs: [{ id: 'output', label: '输出', dataType: 'array' }],
  },
};

const assignmentContract: ComponentContract = {
  componentType: 'Gateway.Assignment',
  displayNameKey: '数据赋值',
  category: 'gateway-data-proc',
  icon: 'Equal',
  color: '#a855f7',
  description: '给一个已存在的数据集进行赋值',
  version: COMPONENT_CONTRACT_V1_VERSION,
  ports: {
    inputs: [{ id: 'input', label: '输入', dataType: 'any' }],
    outputs: [{ id: 'output', label: '输出', dataType: 'any' }],
  },
};

const checkContract: ComponentContract = {
  componentType: 'Gateway.Check',
  displayNameKey: '数据校验',
  category: 'gateway-data-proc',
  icon: 'ShieldCheck',
  color: '#a855f7',
  description: '对数据集中的数据按照规则进行校验，返回校验不通过的数据和错误信息',
  version: COMPONENT_CONTRACT_V1_VERSION,
  ports: {
    inputs: [{ id: 'input', label: '输入', dataType: 'array' }],
    outputs: [{ id: 'output', label: '输出', dataType: 'array' }],
  },
};

const statContract: ComponentContract = {
  componentType: 'Gateway.Stat',
  displayNameKey: '分组统计',
  category: 'gateway-data-proc',
  icon: 'BarChart2',
  color: '#a855f7',
  description: '对列表数据集进行分组统计，类似 SQL 的 GROUP BY',
  version: COMPONENT_CONTRACT_V1_VERSION,
  ports: {
    inputs: [{ id: 'input', label: '输入', dataType: 'array' }],
    outputs: [{ id: 'output', label: '统计结果', dataType: 'array' }],
  },
};

const interLineContract: ComponentContract = {
  componentType: 'Gateway.InterLine',
  displayNameKey: '跨行计算',
  category: 'gateway-data-proc',
  icon: 'Rows',
  color: '#a855f7',
  description: '类似 Oracle lag/lead 函数，在同一分组中按排序进行跨行操作',
  version: COMPONENT_CONTRACT_V1_VERSION,
  ports: {
    inputs: [{ id: 'input', label: '输入', dataType: 'array' }],
    outputs: [{ id: 'output', label: '输出', dataType: 'array' }],
  },
};

const crossTableContract: ComponentContract = {
  componentType: 'Gateway.CrossTable',
  displayNameKey: '交叉制表',
  category: 'gateway-data-proc',
  icon: 'Table',
  color: '#a855f7',
  description: '交叉制表，主要功能是行转列',
  version: COMPONENT_CONTRACT_V1_VERSION,
  ports: {
    inputs: [{ id: 'input', label: '输入', dataType: 'array' }],
    outputs: [{ id: 'output', label: '输出', dataType: 'array' }],
  },
};

const sortContract: ComponentContract = {
  componentType: 'Gateway.Sort',
  displayNameKey: '数据排序',
  category: 'gateway-data-proc',
  icon: 'ArrowUpDown',
  color: '#a855f7',
  description: '将指定的数据根据排序字段进行排序',
  version: COMPONENT_CONTRACT_V1_VERSION,
  ports: {
    inputs: [{ id: 'input', label: '输入', dataType: 'array' }],
    outputs: [{ id: 'output', label: '输出', dataType: 'array' }],
  },
};

const sortAsTreeContract: ComponentContract = {
  componentType: 'Gateway.SortAsTree',
  displayNameKey: '树形排序',
  category: 'gateway-data-proc',
  icon: 'Network',
  color: '#a855f7',
  description: '按照父子关系进行树形排序，生成深度优先遍历的列表',
  version: COMPONENT_CONTRACT_V1_VERSION,
  ports: {
    inputs: [{ id: 'input', label: '输入', dataType: 'array' }],
    outputs: [{ id: 'output', label: '输出', dataType: 'array' }],
  },
};

const toTreeContract: ComponentContract = {
  componentType: 'Gateway.ToTree',
  displayNameKey: '生成树形',
  category: 'gateway-data-proc',
  icon: 'GitFork',
  color: '#a855f7',
  description: '将列表数据转换为树形结构的数据集',
  version: COMPONENT_CONTRACT_V1_VERSION,
  ports: {
    inputs: [{ id: 'input', label: '输入', dataType: 'array' }],
    outputs: [{ id: 'output', label: '树形数据', dataType: 'array' }],
  },
};

const joinContract: ComponentContract = {
  componentType: 'Gateway.Join',
  displayNameKey: '数据关联',
  category: 'gateway-data-proc',
  icon: 'Link',
  color: '#a855f7',
  description: '类似数据库 JOIN 操作，对两个数据集进行左右连接',
  version: COMPONENT_CONTRACT_V1_VERSION,
  ports: {
    inputs: [
      { id: 'left', label: '主数据集', dataType: 'array' },
      { id: 'right', label: '从数据集', dataType: 'array' },
    ],
    outputs: [{ id: 'output', label: '输出', dataType: 'array' }],
  },
};

const unionContract: ComponentContract = {
  componentType: 'Gateway.Union',
  displayNameKey: '数据合并',
  category: 'gateway-data-proc',
  icon: 'Merge',
  color: '#a855f7',
  description: '把两个数据集合并成一个新的数据集',
  version: COMPONENT_CONTRACT_V1_VERSION,
  ports: {
    inputs: [
      { id: 'left', label: '数据集 A', dataType: 'array' },
      { id: 'right', label: '数据集 B', dataType: 'array' },
    ],
    outputs: [{ id: 'output', label: '输出', dataType: 'array' }],
  },
};

const intersectContract: ComponentContract = {
  componentType: 'Gateway.Intersect',
  displayNameKey: '数据交集',
  category: 'gateway-data-proc',
  icon: 'Combine',
  color: '#a855f7',
  description: '求出两个集合的交集数据，按主键比较',
  version: COMPONENT_CONTRACT_V1_VERSION,
  ports: {
    inputs: [
      { id: 'left', label: '数据集 A', dataType: 'array' },
      { id: 'right', label: '数据集 B', dataType: 'array' },
    ],
    outputs: [{ id: 'output', label: '交集', dataType: 'array' }],
  },
};

const minusContract: ComponentContract = {
  componentType: 'Gateway.Minus',
  displayNameKey: '数据差集',
  category: 'gateway-data-proc',
  icon: 'Minus',
  color: '#a855f7',
  description: '求两个集合的差集数据，筛选主数据中主键不在从数据集中的记录',
  version: COMPONENT_CONTRACT_V1_VERSION,
  ports: {
    inputs: [
      { id: 'main', label: '主数据集', dataType: 'array' },
      { id: 'sub', label: '从数据集', dataType: 'array' },
    ],
    outputs: [{ id: 'output', label: '差集', dataType: 'array' }],
  },
};

const compareContract: ComponentContract = {
  componentType: 'Gateway.Compare',
  displayNameKey: '数据比较',
  category: 'gateway-data-proc',
  icon: 'GitCompare',
  color: '#a855f7',
  description: '比较两个数据集之间的变化',
  version: COMPONENT_CONTRACT_V1_VERSION,
  ports: {
    inputs: [
      { id: 'old', label: '旧数据集', dataType: 'array' },
      { id: 'new', label: '新数据集', dataType: 'array' },
    ],
    outputs: [{ id: 'output', label: '比较结果', dataType: 'object' }],
  },
};

const scriptContract: ComponentContract = {
  componentType: 'Gateway.Script',
  displayNameKey: 'JS 脚本',
  category: 'gateway-data-proc',
  icon: 'Code',
  color: '#a855f7',
  description: '利用 Nashorn（Java 嵌入式 JavaScript 引擎）通过 JS 脚本进行处理',
  version: COMPONENT_CONTRACT_V1_VERSION,
  ports: {
    inputs: [{ id: 'input', label: '输入', dataType: 'any' }],
    outputs: [{ id: 'output', label: '输出', dataType: 'any' }],
  },
};

const encryptContract: ComponentContract = {
  componentType: 'Gateway.Encrypt',
  displayNameKey: '数据加密',
  category: 'gateway-data-proc',
  icon: 'Lock',
  color: '#a855f7',
  description: '对数据进行对称加密',
  version: COMPONENT_CONTRACT_V1_VERSION,
  ports: {
    inputs: [{ id: 'input', label: '输入', dataType: 'any' }],
    outputs: [{ id: 'output', label: '加密结果', dataType: 'any' }],
  },
};

const decipherContract: ComponentContract = {
  componentType: 'Gateway.Decipher',
  displayNameKey: '数据解密',
  category: 'gateway-data-proc',
  icon: 'Unlock',
  color: '#a855f7',
  description: '对数据进行解密',
  version: COMPONENT_CONTRACT_V1_VERSION,
  ports: {
    inputs: [{ id: 'input', label: '输入', dataType: 'any' }],
    outputs: [{ id: 'output', label: '解密结果', dataType: 'any' }],
  },
};

const signatureContract: ComponentContract = {
  componentType: 'Gateway.Signature',
  displayNameKey: '数字签名',
  category: 'gateway-data-proc',
  icon: 'PenTool',
  color: '#a855f7',
  description: '对文件或数据进行数字签名与验签，支持 SM2_WITH_SM3 算法',
  version: COMPONENT_CONTRACT_V1_VERSION,
  ports: {
    inputs: [{ id: 'input', label: '输入', dataType: 'any' }],
    outputs: [{ id: 'output', label: '签名结果', dataType: 'any' }],
  },
};


// ---------------------------------------------------------------------------
// ES / Redis Contracts
// ---------------------------------------------------------------------------

const esQueryContract: ComponentContract = {
  componentType: 'Gateway.EsQuery',
  displayNameKey: 'ES 查询',
  category: 'gateway-data',
  icon: 'Database',
  color: '#10b981',
  description: '执行 Elasticsearch 查询',
  version: COMPONENT_CONTRACT_V1_VERSION,
  ports: {
    inputs: [{ id: 'params', label: '查询参数', dataType: 'object' }],
    outputs: [{ id: 'result', label: '查询结果', dataType: 'array' }],
  },
};

const esWriteContract: ComponentContract = {
  componentType: 'Gateway.EsWrite',
  displayNameKey: 'ES 写入',
  category: 'gateway-data',
  icon: 'Database',
  color: '#10b981',
  description: '写入数据到 Elasticsearch',
  version: COMPONENT_CONTRACT_V1_VERSION,
  ports: {
    inputs: [{ id: 'data', label: '数据', dataType: 'object' }],
    outputs: [{ id: 'result', label: '写入结果', dataType: 'object' }],
  },
};

const redisReadContract: ComponentContract = {
  componentType: 'Gateway.RedisRead',
  displayNameKey: 'Redis 读取',
  category: 'gateway-data',
  icon: 'Database',
  color: '#f97316',
  description: '从 Redis 读取数据',
  version: COMPONENT_CONTRACT_V1_VERSION,
  ports: {
    inputs: [{ id: 'key', label: '键', dataType: 'string' }],
    outputs: [{ id: 'value', label: '值', dataType: 'any' }],
  },
};

const redisWriteContract: ComponentContract = {
  componentType: 'Gateway.RedisWrite',
  displayNameKey: 'Redis 写入',
  category: 'gateway-data',
  icon: 'Database',
  color: '#f97316',
  description: '写入数据到 Redis',
  version: COMPONENT_CONTRACT_V1_VERSION,
  ports: {
    inputs: [{ id: 'data', label: '数据', dataType: 'object' }],
    outputs: [{ id: 'result', label: '写入结果', dataType: 'object' }],
  },
};

// ---------------------------------------------------------------------------
// File Contracts
// ---------------------------------------------------------------------------

const excelInContract: ComponentContract = {
  componentType: 'Gateway.ExcelIn',
  displayNameKey: 'Excel 输入',
  category: 'gateway-file',
  icon: 'FileSpreadsheet',
  color: '#22c55e',
  description: '读取 Excel 文件',
  version: COMPONENT_CONTRACT_V1_VERSION,
  ports: {
    inputs: [{ id: 'file', label: '文件', dataType: 'any' }],
    outputs: [{ id: 'data', label: '数据', dataType: 'array' }],
  },
};

const excelOutContract: ComponentContract = {
  componentType: 'Gateway.ExcelOut',
  displayNameKey: 'Excel 输出',
  category: 'gateway-file',
  icon: 'FileSpreadsheet',
  color: '#22c55e',
  description: '写入 Excel 文件',
  version: COMPONENT_CONTRACT_V1_VERSION,
  ports: {
    inputs: [{ id: 'data', label: '数据', dataType: 'array' }],
    outputs: [{ id: 'file', label: '文件', dataType: 'any' }],
  },
};

const zipContract: ComponentContract = {
  componentType: 'Gateway.Zip',
  displayNameKey: '压缩/解压',
  category: 'gateway-file',
  icon: 'FileArchive',
  color: '#64748b',
  description: '压缩或解压文件',
  version: COMPONENT_CONTRACT_V1_VERSION,
  ports: {
    inputs: [{ id: 'input', label: '输入', dataType: 'any' }],
    outputs: [{ id: 'output', label: '输出', dataType: 'any' }],
  },
};

const reportContract: ComponentContract = {
  componentType: 'Gateway.Report',
  displayNameKey: '报表',
  category: 'gateway-file',
  icon: 'FileText',
  color: '#3b82f6',
  description: '生成报表文件',
  version: COMPONENT_CONTRACT_V1_VERSION,
  ports: {
    inputs: [{ id: 'data', label: '数据', dataType: 'object' }],
    outputs: [{ id: 'file', label: '文件', dataType: 'any' }],
  },
};

const markShadeContract: ComponentContract = {
  componentType: 'Gateway.MarkShade',
  displayNameKey: '标记 shading',
  category: 'gateway-file',
  icon: 'Highlighter',
  color: '#f59e0b',
  description: '标记数据区域',
  version: COMPONENT_CONTRACT_V1_VERSION,
  ports: {
    inputs: [{ id: 'input', label: '输入', dataType: 'array' }],
    outputs: [{ id: 'output', label: '输出', dataType: 'array' }],
  },
};

const qrCodeContract: ComponentContract = {
  componentType: 'Gateway.QrCode',
  displayNameKey: '二维码',
  category: 'gateway-file',
  icon: 'QrCode',
  color: '#6366f1',
  description: '生成二维码',
  version: COMPONENT_CONTRACT_V1_VERSION,
  ports: {
    inputs: [{ id: 'data', label: '数据', dataType: 'string' }],
    outputs: [{ id: 'image', label: '图片', dataType: 'any' }],
  },
};

const fileLoadContract: ComponentContract = {
  componentType: 'Gateway.FileLoad',
  displayNameKey: '文件加载',
  category: 'gateway-file',
  icon: 'FileUp',
  color: '#64748b',
  description: '加载文件内容',
  version: COMPONENT_CONTRACT_V1_VERSION,
  ports: {
    inputs: [{ id: 'file', label: '文件', dataType: 'any' }],
    outputs: [{ id: 'content', label: '内容', dataType: 'any' }],
  },
};

const fileSaveContract: ComponentContract = {
  componentType: 'Gateway.FileSave',
  displayNameKey: '文件保存',
  category: 'gateway-file',
  icon: 'FileDown',
  color: '#64748b',
  description: '保存文件',
  version: COMPONENT_CONTRACT_V1_VERSION,
  ports: {
    inputs: [{ id: 'file', label: '文件', dataType: 'any' }, { id: 'content', label: '内容', dataType: 'any' }],
    outputs: [{ id: 'result', label: '结果', dataType: 'object' }],
  },
};

const fileDeleteContract: ComponentContract = {
  componentType: 'Gateway.FileDelete',
  displayNameKey: '文件删除',
  category: 'gateway-file',
  icon: 'FileX',
  color: '#ef4444',
  description: '删除文件',
  version: COMPONENT_CONTRACT_V1_VERSION,
  ports: {
    inputs: [{ id: 'file', label: '文件', dataType: 'any' }],
    outputs: [{ id: 'result', label: '结果', dataType: 'object' }],
  },
};

const fileAuthContract: ComponentContract = {
  componentType: 'Gateway.FileAuth',
  displayNameKey: '文件鉴权',
  category: 'gateway-file',
  icon: 'FileLock',
  color: '#8b5cf6',
  description: '文件权限鉴权',
  version: COMPONENT_CONTRACT_V1_VERSION,
  ports: {
    inputs: [{ id: 'file', label: '文件', dataType: 'any' }, { id: 'user', label: '用户', dataType: 'object' }],
    outputs: [{ id: 'result', label: '结果', dataType: 'object' }],
  },
};

const chartImageContract: ComponentContract = {
  componentType: 'Gateway.ChartImage',
  displayNameKey: '图表图片',
  category: 'gateway-file',
  icon: 'Image',
  color: '#3b82f6',
  description: '生成图表图片',
  version: COMPONENT_CONTRACT_V1_VERSION,
  ports: {
    inputs: [{ id: 'data', label: '数据', dataType: 'array' }],
    outputs: [{ id: 'image', label: '图片', dataType: 'any' }],
  },
};

const toPdfContract: ComponentContract = {
  componentType: 'Gateway.ToPdf',
  displayNameKey: '转 PDF',
  category: 'gateway-file',
  icon: 'FileText',
  color: '#ef4444',
  description: '转换为 PDF 文件',
  version: COMPONENT_CONTRACT_V1_VERSION,
  ports: {
    inputs: [{ id: 'file', label: '文件', dataType: 'any' }],
    outputs: [{ id: 'pdf', label: 'PDF', dataType: 'any' }],
  },
};

const ftpUploadContract: ComponentContract = {
  componentType: 'Gateway.FtpUpload',
  displayNameKey: 'FTP 上传',
  category: 'gateway-file',
  icon: 'Upload',
  color: '#22c55e',
  description: '上传文件到 FTP',
  version: COMPONENT_CONTRACT_V1_VERSION,
  ports: {
    inputs: [{ id: 'file', label: '文件', dataType: 'any' }],
    outputs: [{ id: 'result', label: '结果', dataType: 'object' }],
  },
};

const ftpDownloadContract: ComponentContract = {
  componentType: 'Gateway.FtpDownload',
  displayNameKey: 'FTP 下载',
  category: 'gateway-file',
  icon: 'Download',
  color: '#22c55e',
  description: '从 FTP 下载文件',
  version: COMPONENT_CONTRACT_V1_VERSION,
  ports: {
    inputs: [{ id: 'path', label: '路径', dataType: 'string' }],
    outputs: [{ id: 'file', label: '文件', dataType: 'any' }],
  },
};

const fileCheckContract: ComponentContract = {
  componentType: 'Gateway.FileCheck',
  displayNameKey: '文件检查',
  category: 'gateway-file',
  icon: 'FileCheck',
  color: '#22c55e',
  description: '检查文件',
  version: COMPONENT_CONTRACT_V1_VERSION,
  ports: {
    inputs: [{ id: 'file', label: '文件', dataType: 'any' }],
    outputs: [{ id: 'result', label: '结果', dataType: 'object' }],
  },
};

const fileMergeContract: ComponentContract = {
  componentType: 'Gateway.FileMerge',
  displayNameKey: '文件合并',
  category: 'gateway-file',
  icon: 'Combine',
  color: '#3b82f6',
  description: '合并多个文件',
  version: COMPONENT_CONTRACT_V1_VERSION,
  ports: {
    inputs: [{ id: 'files', label: '文件列表', dataType: 'array' }],
    outputs: [{ id: 'file', label: '合并后的文件', dataType: 'any' }],
  },
};

const csvReadContract: ComponentContract = {
  componentType: 'Gateway.CsvRead',
  displayNameKey: 'CSV 读取',
  category: 'gateway-file',
  icon: 'FileSpreadsheet',
  color: '#22c55e',
  description: '读取 CSV 文件',
  version: COMPONENT_CONTRACT_V1_VERSION,
  ports: {
    inputs: [{ id: 'file', label: '文件', dataType: 'any' }],
    outputs: [{ id: 'data', label: '数据', dataType: 'array' }],
  },
};

const csvWriteContract: ComponentContract = {
  componentType: 'Gateway.CsvWrite',
  displayNameKey: 'CSV 写入',
  category: 'gateway-file',
  icon: 'FileSpreadsheet',
  color: '#22c55e',
  description: '写入 CSV 文件',
  version: COMPONENT_CONTRACT_V1_VERSION,
  ports: {
    inputs: [{ id: 'data', label: '数据', dataType: 'array' }],
    outputs: [{ id: 'file', label: '文件', dataType: 'any' }],
  },
};

const objReadContract: ComponentContract = {
  componentType: 'Gateway.ObjRead',
  displayNameKey: '对象读取',
  category: 'gateway-file',
  icon: 'Package',
  color: '#3b82f6',
  description: '读取序列化对象',
  version: COMPONENT_CONTRACT_V1_VERSION,
  ports: {
    inputs: [{ id: 'file', label: '文件', dataType: 'any' }],
    outputs: [{ id: 'object', label: '对象', dataType: 'object' }],
  },
};

const objWriteContract: ComponentContract = {
  componentType: 'Gateway.ObjWrite',
  displayNameKey: '对象写入',
  category: 'gateway-file',
  icon: 'Package',
  color: '#3b82f6',
  description: '写入序列化对象',
  version: COMPONENT_CONTRACT_V1_VERSION,
  ports: {
    inputs: [{ id: 'object', label: '对象', dataType: 'object' }],
    outputs: [{ id: 'file', label: '文件', dataType: 'any' }],
  },
};

const sqliteOutContract: ComponentContract = {
  componentType: 'Gateway.SqliteOut',
  displayNameKey: 'SQLite 输出',
  category: 'gateway-file',
  icon: 'Database',
  color: '#ef4444',
  description: '输出到 SQLite',
  version: COMPONENT_CONTRACT_V1_VERSION,
  ports: {
    inputs: [{ id: 'data', label: '数据', dataType: 'array' }],
    outputs: [{ id: 'result', label: '结果', dataType: 'object' }],
  },
};

const sqliteInContract: ComponentContract = {
  componentType: 'Gateway.SqliteIn',
  displayNameKey: 'SQLite 输入',
  category: 'gateway-file',
  icon: 'Database',
  color: '#22c55e',
  description: '从 SQLite 读取',
  version: COMPONENT_CONTRACT_V1_VERSION,
  ports: {
    inputs: [{ id: 'params', label: '参数', dataType: 'object' }],
    outputs: [{ id: 'data', label: '数据', dataType: 'array' }],
  },
};

// ---------------------------------------------------------------------------
// Workflow Contracts
// ---------------------------------------------------------------------------

const createFlowContract: ComponentContract = {
  componentType: 'Gateway.CreateFlow',
  displayNameKey: '创建流程',
  category: 'gateway-workflow',
  icon: 'Plus',
  color: '#3b82f6',
  description: '创建新流程实例',
  version: COMPONENT_CONTRACT_V1_VERSION,
  ports: {
    inputs: [{ id: 'params', label: '参数', dataType: 'object' }],
    outputs: [{ id: 'flowId', label: '流程 ID', dataType: 'string' }],
  },
};

const submitFlowContract: ComponentContract = {
  componentType: 'Gateway.SubmitFlow',
  displayNameKey: '提交流程',
  category: 'gateway-workflow',
  icon: 'Check',
  color: '#22c55e',
  description: '提交流程实例',
  version: COMPONENT_CONTRACT_V1_VERSION,
  ports: {
    inputs: [{ id: 'flowId', label: '流程 ID', dataType: 'string' }],
    outputs: [{ id: 'result', label: '结果', dataType: 'object' }],
  },
};

const taskListContract: ComponentContract = {
  componentType: 'Gateway.TaskList',
  displayNameKey: '任务列表',
  category: 'gateway-workflow',
  icon: 'List',
  color: '#3b82f6',
  description: '获取任务列表',
  version: COMPONENT_CONTRACT_V1_VERSION,
  ports: {
    inputs: [{ id: 'params', label: '参数', dataType: 'object' }],
    outputs: [{ id: 'tasks', label: '任务列表', dataType: 'array' }],
  },
};

const taskManagerContract: ComponentContract = {
  componentType: 'Gateway.TaskManager',
  displayNameKey: '任务管理',
  category: 'gateway-workflow',
  icon: 'Settings',
  color: '#64748b',
  description: '管理任务',
  version: COMPONENT_CONTRACT_V1_VERSION,
  ports: {
    inputs: [{ id: 'task', label: '任务', dataType: 'object' }],
    outputs: [{ id: 'result', label: '结果', dataType: 'object' }],
  },
};

const flowRuntimeContract: ComponentContract = {
  componentType: 'Gateway.FlowRuntime',
  displayNameKey: '流程运行时',
  category: 'gateway-workflow',
  icon: 'Play',
  color: '#10b981',
  description: '流程运行时操作',
  version: COMPONENT_CONTRACT_V1_VERSION,
  ports: {
    inputs: [{ id: 'flowId', label: '流程 ID', dataType: 'string' }],
    outputs: [{ id: 'result', label: '结果', dataType: 'object' }],
  },
};

const flowStatusContract: ComponentContract = {
  componentType: 'Gateway.FlowStatus',
  displayNameKey: '流程状态',
  category: 'gateway-workflow',
  icon: 'Activity',
  color: '#f59e0b',
  description: '获取流程状态',
  version: COMPONENT_CONTRACT_V1_VERSION,
  ports: {
    inputs: [{ id: 'flowId', label: '流程 ID', dataType: 'string' }],
    outputs: [{ id: 'status', label: '状态', dataType: 'object' }],
  },
};

const flowDispatchContract: ComponentContract = {
  componentType: 'Gateway.FlowDispatch',
  displayNameKey: '流程分发',
  category: 'gateway-workflow',
  icon: 'Share2',
  color: '#8b5cf6',
  description: '流程分发',
  version: COMPONENT_CONTRACT_V1_VERSION,
  ports: {
    inputs: [{ id: 'flowId', label: '流程 ID', dataType: 'string' }],
    outputs: [{ id: 'result', label: '结果', dataType: 'object' }],
  },
};

// ---------------------------------------------------------------------------
// System Contracts
// ---------------------------------------------------------------------------

const unitFilterContract: ComponentContract = {
  componentType: 'Gateway.UnitFilter',
  displayNameKey: '单位筛选',
  category: 'gateway-system',
  icon: 'Filter',
  color: '#64748b',
  description: '按单位筛选',
  version: COMPONENT_CONTRACT_V1_VERSION,
  ports: {
    inputs: [{ id: 'params', label: '参数', dataType: 'object' }],
    outputs: [{ id: 'units', label: '单位列表', dataType: 'array' }],
  },
};

const userFilterContract: ComponentContract = {
  componentType: 'Gateway.UserFilter',
  displayNameKey: '用户筛选',
  category: 'gateway-system',
  icon: 'Filter',
  color: '#64748b',
  description: '按用户筛选',
  version: COMPONENT_CONTRACT_V1_VERSION,
  ports: {
    inputs: [{ id: 'params', label: '参数', dataType: 'object' }],
    outputs: [{ id: 'users', label: '用户列表', dataType: 'array' }],
  },
};

const userManagerContract: ComponentContract = {
  componentType: 'Gateway.UserManager',
  displayNameKey: '用户管理',
  category: 'gateway-system',
  icon: 'Users',
  color: '#3b82f6',
  description: '管理用户',
  version: COMPONENT_CONTRACT_V1_VERSION,
  ports: {
    inputs: [{ id: 'user', label: '用户', dataType: 'object' }],
    outputs: [{ id: 'result', label: '结果', dataType: 'object' }],
  },
};

const unitManagerContract: ComponentContract = {
  componentType: 'Gateway.UnitManager',
  displayNameKey: '单位管理',
  category: 'gateway-system',
  icon: 'Building',
  color: '#3b82f6',
  description: '管理单位',
  version: COMPONENT_CONTRACT_V1_VERSION,
  ports: {
    inputs: [{ id: 'unit', label: '单位', dataType: 'object' }],
    outputs: [{ id: 'result', label: '结果', dataType: 'object' }],
  },
};

const userRoleMContract: ComponentContract = {
  componentType: 'Gateway.UserRoleM',
  displayNameKey: '用户角色管理',
  category: 'gateway-system',
  icon: 'UserCheck',
  color: '#8b5cf6',
  description: '管理用户角色',
  version: COMPONENT_CONTRACT_V1_VERSION,
  ports: {
    inputs: [{ id: 'data', label: '数据', dataType: 'object' }],
    outputs: [{ id: 'result', label: '结果', dataType: 'object' }],
  },
};

const userUnitMContract: ComponentContract = {
  componentType: 'Gateway.UserUnitM',
  displayNameKey: '用户单位管理',
  category: 'gateway-system',
  icon: 'UserCheck',
  color: '#8b5cf6',
  description: '管理用户单位',
  version: COMPONENT_CONTRACT_V1_VERSION,
  ports: {
    inputs: [{ id: 'data', label: '数据', dataType: 'object' }],
    outputs: [{ id: 'result', label: '结果', dataType: 'object' }],
  },
};

const userRoleQContract: ComponentContract = {
  componentType: 'Gateway.UserRoleQ',
  displayNameKey: '用户角色查询',
  category: 'gateway-system',
  icon: 'UserSearch',
  color: '#22c55e',
  description: '查询用户角色',
  version: COMPONENT_CONTRACT_V1_VERSION,
  ports: {
    inputs: [{ id: 'params', label: '参数', dataType: 'object' }],
    outputs: [{ id: 'roles', label: '角色列表', dataType: 'array' }],
  },
};

const userUnitQContract: ComponentContract = {
  componentType: 'Gateway.UserUnitQ',
  displayNameKey: '用户单位查询',
  category: 'gateway-system',
  icon: 'UserSearch',
  color: '#22c55e',
  description: '查询用户单位',
  version: COMPONENT_CONTRACT_V1_VERSION,
  ports: {
    inputs: [{ id: 'params', label: '参数', dataType: 'object' }],
    outputs: [{ id: 'units', label: '单位列表', dataType: 'array' }],
  },
};

const dictionaryContract: ComponentContract = {
  componentType: 'Gateway.Dictionary',
  displayNameKey: '字典',
  category: 'gateway-system',
  icon: 'Book',
  color: '#3b82f6',
  description: '数据字典操作',
  version: COMPONENT_CONTRACT_V1_VERSION,
  ports: {
    inputs: [{ id: 'params', label: '参数', dataType: 'object' }],
    outputs: [{ id: 'data', label: '数据', dataType: 'array' }],
  },
};

const noticeContract: ComponentContract = {
  componentType: 'Gateway.Notice',
  displayNameKey: '通知',
  category: 'gateway-system',
  icon: 'Bell',
  color: '#f59e0b',
  description: '发送通知',
  version: COMPONENT_CONTRACT_V1_VERSION,
  ports: {
    inputs: [{ id: 'notice', label: '通知', dataType: 'object' }],
    outputs: [{ id: 'result', label: '结果', dataType: 'object' }],
  },
};

const logWriteContract: ComponentContract = {
  componentType: 'Gateway.LogWrite',
  displayNameKey: '日志写入',
  category: 'gateway-system',
  icon: 'FilePlus',
  color: '#64748b',
  description: '写入日志',
  version: COMPONENT_CONTRACT_V1_VERSION,
  ports: {
    inputs: [{ id: 'log', label: '日志', dataType: 'object' }],
    outputs: [{ id: 'result', label: '结果', dataType: 'object' }],
  },
};

const logQueryContract: ComponentContract = {
  componentType: 'Gateway.LogQuery',
  displayNameKey: '日志查询',
  category: 'gateway-system',
  icon: 'FileSearch',
  color: '#22c55e',
  description: '查询日志',
  version: COMPONENT_CONTRACT_V1_VERSION,
  ports: {
    inputs: [{ id: 'params', label: '参数', dataType: 'object' }],
    outputs: [{ id: 'logs', label: '日志列表', dataType: 'array' }],
  },
};

const serialNumberContract: ComponentContract = {
  componentType: 'Gateway.SerialNumber',
  displayNameKey: '流水号',
  category: 'gateway-system',
  icon: 'Hash',
  color: '#3b82f6',
  description: '生成流水号',
  version: COMPONENT_CONTRACT_V1_VERSION,
  ports: {
    inputs: [{ id: 'params', label: '参数', dataType: 'object' }],
    outputs: [{ id: 'serialNo', label: '流水号', dataType: 'string' }],
  },
};

const sessionDataContract: ComponentContract = {
  componentType: 'Gateway.SessionData',
  displayNameKey: '会话数据',
  category: 'gateway-system',
  icon: 'Database',
  color: '#64748b',
  description: '会话数据操作',
  version: COMPONENT_CONTRACT_V1_VERSION,
  ports: {
    inputs: [{ id: 'data', label: '数据', dataType: 'object' }],
    outputs: [{ id: 'result', label: '结果', dataType: 'object' }],
  },
};

const workCalendarContract: ComponentContract = {
  componentType: 'Gateway.WorkCalendar',
  displayNameKey: '工作日历',
  category: 'gateway-system',
  icon: 'Calendar',
  color: '#3b82f6',
  description: '工作日历操作',
  version: COMPONENT_CONTRACT_V1_VERSION,
  ports: {
    inputs: [{ id: 'params', label: '参数', dataType: 'object' }],
    outputs: [{ id: 'calendar', label: '日历', dataType: 'object' }],
  },
};

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

/** All built-in gateway node contracts */
export const gatewayContracts: ComponentContract[] = [
  // Endpoints
  startContract,
  endContract,
  // Data
  dataDefinitionContract,
  metadataContract,
  sqlQueryContract,
  // Flow Control
  branchContract,
  loopStartContract,
  loopEndContract,
  loopBreakContract,
  loopContinueContract,
  // Database
  queryContract,
  updateContract,
  sqlRunContract,
  sqlWriteContract,
  commitContract,
  // HTTP / Module
  httpContract,
  callModuleContract,
  // Data Processing
  defineDataContract,
  mapContract,
  filterContract,
  appendContract,
  desensitizeContract,
  assignmentContract,
  checkContract,
  statContract,
  interLineContract,
  crossTableContract,
  sortContract,
  sortAsTreeContract,
  toTreeContract,
  joinContract,
  unionContract,
  intersectContract,
  minusContract,
  compareContract,
  scriptContract,
  encryptContract,
  decipherContract,
  signatureContract,
  // ES / Redis
  esQueryContract,
  esWriteContract,
  redisReadContract,
  redisWriteContract,
  // File
  excelInContract,
  excelOutContract,
  zipContract,
  reportContract,
  markShadeContract,
  qrCodeContract,
  fileLoadContract,
  fileSaveContract,
  fileDeleteContract,
  fileAuthContract,
  chartImageContract,
  toPdfContract,
  ftpUploadContract,
  ftpDownloadContract,
  fileCheckContract,
  fileMergeContract,
  csvReadContract,
  csvWriteContract,
  objReadContract,
  objWriteContract,
  sqliteOutContract,
  sqliteInContract,
  // Workflow
  createFlowContract,
  submitFlowContract,
  taskListContract,
  taskManagerContract,
  flowRuntimeContract,
  flowStatusContract,
  flowDispatchContract,
  // System
  unitFilterContract,
  userFilterContract,
  userManagerContract,
  unitManagerContract,
  userRoleMContract,
  userUnitMContract,
  userRoleQContract,
  userUnitQContract,
  dictionaryContract,
  noticeContract,
  logWriteContract,
  logQueryContract,
  serialNumberContract,
  sessionDataContract,
  workCalendarContract,
];

/** Quick lookup by componentType */
export const gatewayContractMap: Record<string, ComponentContract> = Object.fromEntries(
  gatewayContracts.map((c) => [c.componentType, c]),
);

/** Quick lookup by runtime kind (e.g. 'start', 'sql-query') */
export const gatewayContractByKind: Record<string, ComponentContract> = Object.fromEntries(
  Object.entries(GATEWAY_KIND_TO_COMPONENT_TYPE)
    .filter(([, componentType]) => componentType in gatewayContractMap)
    .map(([kind, componentType]) => [kind, gatewayContractMap[componentType]!]),
);

/** Get gateway contract by componentType */
export function getGatewayContract(componentType: string): ComponentContract | undefined {
  return gatewayContractMap[componentType];
}

/** Get gateway contract by runtime kind */
export function getGatewayContractByKind(kind: string): ComponentContract | undefined {
  return gatewayContractByKind[kind];
}
