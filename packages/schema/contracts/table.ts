import {
  COMPONENT_CONTRACT_V1_VERSION,
  type ContractProp,
  type ComponentContract,
} from '../types/contract';
import { paginationShape } from './navigation';

export const rowSelectionShape: Record<string, ContractProp> = {
  type: {
    type: 'enum',
    enum: ['checkbox', 'radio'],
  },
  selectedRowKeys: {
    type: 'array',
    allowExpression: true,
  },
  preserveSelectedRowKeys: {
    type: 'boolean',
    allowExpression: true,
  },
  checkStrictly: {
    type: 'boolean',
    allowExpression: true,
  },
  columnWidth: {
    type: 'number',
    allowExpression: true,
  },
};

export const tableContract: ComponentContract = {
  componentType: 'Table',
  runtimeType: 'antd.Table',
  category: 'data-display',
  icon: 'Table',
  usageScenario: '展示多行结构化数据列表，支持分页、排序、筛选',
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
      type: 'any',
      allowExpression: true,
      oneOf: [
        {
          type: 'boolean',
          enum: [false],
        },
        {
          type: 'object',
          shape: paginationShape,
        },
      ],
    },
    rowSelection: {
      type: 'object',
      allowExpression: true,
      shape: rowSelectionShape,
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
