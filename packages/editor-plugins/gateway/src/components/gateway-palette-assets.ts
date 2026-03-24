import type { ComponentContract } from '@shenbi/schema';
import { gatewayContracts, gatewayContractByKind, GATEWAY_COMPONENT_TYPE_TO_KIND } from '@shenbi/schema';
import type { PaletteAsset, PaletteAssetGroup } from '@shenbi/editor-ui';
import type { GatewayNodeKind } from '../types';
import { getContractInputs, getContractOutputs } from '../types';

type GatewayGroupConfig = {
  name: string;
  assets: PaletteAsset[];
};

const LOOP_CHILD_KINDS: GatewayNodeKind[] = [
  'loop-start',
  'loop-end',
  'loop-break',
  'loop-continue',
];

function contractToKind(contract: ComponentContract): string {
  return GATEWAY_COMPONENT_TYPE_TO_KIND[contract.componentType as keyof typeof GATEWAY_COMPONENT_TYPE_TO_KIND]
    ?? contract.componentType;
}

function buildGatewayNodeAsset(
  contract: ComponentContract,
  groupId: string,
  groupName: string,
  overrides: Partial<PaletteAsset> = {},
): PaletteAsset {
  const kind = contractToKind(contract);
  const inputs = getContractInputs(contract);
  const outputs = getContractOutputs(contract);
  const canBridge = inputs.length > 0 && outputs.length > 0;
  const canQuickInsert = inputs.length > 0;
  const visibleInSidebar = kind !== 'start';
  const label = contract.displayNameKey ?? kind;

  return {
    id: kind,
    type: kind,
    name: label,
    description: contract.description,
    icon: contract.icon,
    color: contract.color,
    sourceType: 'gateway-node',
    groupId,
    groupName,
    dragPayload: {
      kind: 'gateway-node',
      type: kind,
      label,
      description: contract.description,
      icon: contract.icon,
      meta: {
        color: contract.color,
      },
    },
    draggable: visibleInSidebar,
    insertable: true,
    visibility: {
      sidebar: visibleInSidebar,
      'quick-insert': canQuickInsert && kind !== 'start',
      'edge-insert': canBridge && kind !== 'start' && kind !== 'end',
    },
    extra: {
      bridgeable: canBridge,
      allowQuickInsert: canQuickInsert,
      maxInstances: contract.maxInstances,
    },
    ...overrides,
  };
}

function buildLoopGroupAsset(groupId: string, groupName: string): PaletteAsset {
  const loopContract = gatewayContractByKind['loop-start']!;

  return {
    id: 'loop-group',
    type: 'loop-start',
    name: '循环',
    description: '循环控制节点集合，包含开始、结束、跳出和继续循环。',
    icon: loopContract.icon,
    color: loopContract.color,
    sourceType: 'gateway-node',
    groupId,
    groupName,
    dragPayload: {
      kind: 'gateway-node',
      type: 'loop-start',
      label: loopContract.description ?? '开始循环',
      description: loopContract.description,
      icon: loopContract.icon,
      meta: {
        color: loopContract.color,
      },
    },
    draggable: false,
    insertable: false,
    visibility: {
      sidebar: true,
      'quick-insert': true,
      'edge-insert': true,
    },
    children: LOOP_CHILD_KINDS.map((kind) =>
      buildGatewayNodeAsset(gatewayContractByKind[kind]!, groupId, groupName),
    ),
    extra: {
      bridgeable: false,
      allowQuickInsert: false,
    },
  };
}

const startContract = gatewayContractByKind['start']!;
const endContract = gatewayContractByKind['end']!;

const GATEWAY_GROUPS: Record<string, GatewayGroupConfig> = {
  endpoints: {
    name: '入口 / 出口',
    assets: [
      buildGatewayNodeAsset(startContract, 'endpoints', '入口 / 出口', {
        draggable: false,
        insertable: false,
        visibility: {
          sidebar: false,
          'quick-insert': false,
          'edge-insert': false,
        },
      }),
      buildGatewayNodeAsset(endContract, 'endpoints', '入口 / 出口'),
    ],
  },
  data: {
    name: '数据',
    assets: [
      buildGatewayNodeAsset(gatewayContractByKind['data-definition']!, 'data', '数据'),
      buildGatewayNodeAsset(gatewayContractByKind['metadata']!, 'data', '数据'),
      buildGatewayNodeAsset(gatewayContractByKind['sql-query']!, 'data', '数据'),
    ],
  },
  flow: {
    name: '流程控制',
    assets: [
      buildGatewayNodeAsset(gatewayContractByKind['branch']!, 'flow', '流程控制'),
      buildLoopGroupAsset('flow', '流程控制'),
    ],
  },
  database: {
    name: '数据库',
    assets: [
      buildGatewayNodeAsset(gatewayContractByKind['query']!, 'database', '数据库'),
      buildGatewayNodeAsset(gatewayContractByKind['update']!, 'database', '数据库'),
      buildGatewayNodeAsset(gatewayContractByKind['sql-run']!, 'database', '数据库'),
      buildGatewayNodeAsset(gatewayContractByKind['sql-write']!, 'database', '数据库'),
      buildGatewayNodeAsset(gatewayContractByKind['commit']!, 'database', '数据库'),
    ],
  },
  'http-module': {
    name: 'HTTP / 模块',
    assets: [
      buildGatewayNodeAsset(gatewayContractByKind['http']!, 'http-module', 'HTTP / 模块'),
      buildGatewayNodeAsset(gatewayContractByKind['call-module']!, 'http-module', 'HTTP / 模块'),
    ],
  },
  'data-proc': {
    name: '数据处理',
    assets: [
      buildGatewayNodeAsset(gatewayContractByKind['define-data']!, 'data-proc', '数据处理'),
      buildGatewayNodeAsset(gatewayContractByKind['map']!, 'data-proc', '数据处理'),
      buildGatewayNodeAsset(gatewayContractByKind['filter']!, 'data-proc', '数据处理'),
      buildGatewayNodeAsset(gatewayContractByKind['append']!, 'data-proc', '数据处理'),
      buildGatewayNodeAsset(gatewayContractByKind['desensitize']!, 'data-proc', '数据处理'),
      buildGatewayNodeAsset(gatewayContractByKind['assignment']!, 'data-proc', '数据处理'),
      buildGatewayNodeAsset(gatewayContractByKind['check']!, 'data-proc', '数据处理'),
      buildGatewayNodeAsset(gatewayContractByKind['stat']!, 'data-proc', '数据处理'),
      buildGatewayNodeAsset(gatewayContractByKind['inter-line']!, 'data-proc', '数据处理'),
      buildGatewayNodeAsset(gatewayContractByKind['cross-table']!, 'data-proc', '数据处理'),
      buildGatewayNodeAsset(gatewayContractByKind['sort']!, 'data-proc', '数据处理'),
      buildGatewayNodeAsset(gatewayContractByKind['sort-as-tree']!, 'data-proc', '数据处理'),
      buildGatewayNodeAsset(gatewayContractByKind['to-tree']!, 'data-proc', '数据处理'),
      buildGatewayNodeAsset(gatewayContractByKind['join']!, 'data-proc', '数据处理'),
      buildGatewayNodeAsset(gatewayContractByKind['union']!, 'data-proc', '数据处理'),
      buildGatewayNodeAsset(gatewayContractByKind['intersect']!, 'data-proc', '数据处理'),
      buildGatewayNodeAsset(gatewayContractByKind['minus']!, 'data-proc', '数据处理'),
      buildGatewayNodeAsset(gatewayContractByKind['compare']!, 'data-proc', '数据处理'),
      buildGatewayNodeAsset(gatewayContractByKind['script']!, 'data-proc', '数据处理'),
      buildGatewayNodeAsset(gatewayContractByKind['encrypt']!, 'data-proc', '数据处理'),
      buildGatewayNodeAsset(gatewayContractByKind['decipher']!, 'data-proc', '数据处理'),
      buildGatewayNodeAsset(gatewayContractByKind['signature']!, 'data-proc', '数据处理'),
    ],
  },
  'es-redis': {
    name: 'ES / Redis',
    assets: [
      buildGatewayNodeAsset(gatewayContractByKind['es-query']!, 'es-redis', 'ES / Redis'),
      buildGatewayNodeAsset(gatewayContractByKind['es-write']!, 'es-redis', 'ES / Redis'),
      buildGatewayNodeAsset(gatewayContractByKind['redis-read']!, 'es-redis', 'ES / Redis'),
      buildGatewayNodeAsset(gatewayContractByKind['redis-write']!, 'es-redis', 'ES / Redis'),
    ],
  },
  file: {
    name: '文件',
    assets: [
      buildGatewayNodeAsset(gatewayContractByKind['excel-in']!, 'file', '文件'),
      buildGatewayNodeAsset(gatewayContractByKind['excel-out']!, 'file', '文件'),
      buildGatewayNodeAsset(gatewayContractByKind['zip']!, 'file', '文件'),
      buildGatewayNodeAsset(gatewayContractByKind['report']!, 'file', '文件'),
      buildGatewayNodeAsset(gatewayContractByKind['mark-shade']!, 'file', '文件'),
      buildGatewayNodeAsset(gatewayContractByKind['qr-code']!, 'file', '文件'),
      buildGatewayNodeAsset(gatewayContractByKind['file-load']!, 'file', '文件'),
      buildGatewayNodeAsset(gatewayContractByKind['file-save']!, 'file', '文件'),
      buildGatewayNodeAsset(gatewayContractByKind['file-delete']!, 'file', '文件'),
      buildGatewayNodeAsset(gatewayContractByKind['file-auth']!, 'file', '文件'),
      buildGatewayNodeAsset(gatewayContractByKind['chart-image']!, 'file', '文件'),
      buildGatewayNodeAsset(gatewayContractByKind['to-pdf']!, 'file', '文件'),
      buildGatewayNodeAsset(gatewayContractByKind['ftp-upload']!, 'file', '文件'),
      buildGatewayNodeAsset(gatewayContractByKind['ftp-download']!, 'file', '文件'),
      buildGatewayNodeAsset(gatewayContractByKind['file-check']!, 'file', '文件'),
      buildGatewayNodeAsset(gatewayContractByKind['file-merge']!, 'file', '文件'),
      buildGatewayNodeAsset(gatewayContractByKind['csv-read']!, 'file', '文件'),
      buildGatewayNodeAsset(gatewayContractByKind['csv-write']!, 'file', '文件'),
      buildGatewayNodeAsset(gatewayContractByKind['obj-read']!, 'file', '文件'),
      buildGatewayNodeAsset(gatewayContractByKind['obj-write']!, 'file', '文件'),
      buildGatewayNodeAsset(gatewayContractByKind['sqlite-out']!, 'file', '文件'),
      buildGatewayNodeAsset(gatewayContractByKind['sqlite-in']!, 'file', '文件'),
    ],
  },
  workflow: {
    name: '工作流',
    assets: [
      buildGatewayNodeAsset(gatewayContractByKind['create-flow']!, 'workflow', '工作流'),
      buildGatewayNodeAsset(gatewayContractByKind['submit-flow']!, 'workflow', '工作流'),
      buildGatewayNodeAsset(gatewayContractByKind['task-list']!, 'workflow', '工作流'),
      buildGatewayNodeAsset(gatewayContractByKind['task-manager']!, 'workflow', '工作流'),
      buildGatewayNodeAsset(gatewayContractByKind['flow-runtime']!, 'workflow', '工作流'),
      buildGatewayNodeAsset(gatewayContractByKind['flow-status']!, 'workflow', '工作流'),
      buildGatewayNodeAsset(gatewayContractByKind['flow-dispatch']!, 'workflow', '工作流'),
    ],
  },
  system: {
    name: '系统',
    assets: [
      buildGatewayNodeAsset(gatewayContractByKind['unit-filter']!, 'system', '系统'),
      buildGatewayNodeAsset(gatewayContractByKind['user-filter']!, 'system', '系统'),
      buildGatewayNodeAsset(gatewayContractByKind['user-manager']!, 'system', '系统'),
      buildGatewayNodeAsset(gatewayContractByKind['unit-manager']!, 'system', '系统'),
      buildGatewayNodeAsset(gatewayContractByKind['user-role-m']!, 'system', '系统'),
      buildGatewayNodeAsset(gatewayContractByKind['user-unit-m']!, 'system', '系统'),
      buildGatewayNodeAsset(gatewayContractByKind['user-role-q']!, 'system', '系统'),
      buildGatewayNodeAsset(gatewayContractByKind['user-unit-q']!, 'system', '系统'),
      buildGatewayNodeAsset(gatewayContractByKind['dictionary']!, 'system', '系统'),
      buildGatewayNodeAsset(gatewayContractByKind['notice']!, 'system', '系统'),
      buildGatewayNodeAsset(gatewayContractByKind['log-write']!, 'system', '系统'),
      buildGatewayNodeAsset(gatewayContractByKind['log-query']!, 'system', '系统'),
      buildGatewayNodeAsset(gatewayContractByKind['serial-number']!, 'system', '系统'),
      buildGatewayNodeAsset(gatewayContractByKind['session-data']!, 'system', '系统'),
      buildGatewayNodeAsset(gatewayContractByKind['work-calendar']!, 'system', '系统'),
    ],
  },
};

export function buildGatewayPaletteAssets(): PaletteAssetGroup[] {
  return Object.entries(GATEWAY_GROUPS).map(([groupId, group]) => ({
    id: groupId,
    name: group.name,
    assets: group.assets,
  }));
}
