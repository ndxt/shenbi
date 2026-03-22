import type { PaletteAsset, PaletteAssetGroup } from '@shenbi/editor-ui';
import { NODE_CONTRACTS, type GatewayNodeKind } from '../types';

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

function buildGatewayNodeAsset(
  kind: GatewayNodeKind,
  groupId: string,
  groupName: string,
  overrides: Partial<PaletteAsset> = {},
): PaletteAsset {
  const contract = NODE_CONTRACTS[kind];
  const canBridge = contract.inputs.length > 0 && contract.outputs.length > 0;
  const canQuickInsert = contract.inputs.length > 0;
  const visibleInSidebar = kind !== 'start';

  return {
    id: kind,
    type: kind,
    name: contract.label,
    description: contract.description,
    icon: contract.icon,
    color: contract.color,
    sourceType: 'gateway-node',
    groupId,
    groupName,
    dragPayload: {
      kind: 'gateway-node',
      type: kind,
      label: contract.label,
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
    gateway: {
      bridgeable: canBridge,
      allowQuickInsert: canQuickInsert,
      maxInstances: contract.maxInstances,
    },
    ...overrides,
  };
}

function buildLoopGroupAsset(groupId: string, groupName: string): PaletteAsset {
  const loopContract = NODE_CONTRACTS.loop;

  return {
    id: 'loop',
    type: 'loop',
    name: loopContract.label,
    description: '循环控制节点集合，包含开始、结束、跳出和继续循环。',
    icon: loopContract.icon,
    color: loopContract.color,
    sourceType: 'gateway-node',
    groupId,
    groupName,
    dragPayload: {
      kind: 'gateway-node',
      type: loopContract.kind,
      label: loopContract.label,
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
    children: LOOP_CHILD_KINDS.map((kind) => buildGatewayNodeAsset(kind, groupId, groupName)),
    gateway: {
      bridgeable: false,
      allowQuickInsert: false,
    },
  };
}

const GATEWAY_GROUPS: Record<string, GatewayGroupConfig> = {
  endpoints: {
    name: '入口 / 出口',
    assets: [
      buildGatewayNodeAsset('start', 'endpoints', '入口 / 出口', {
        draggable: false,
        insertable: false,
        visibility: {
          sidebar: false,
          'quick-insert': false,
          'edge-insert': false,
        },
      }),
      buildGatewayNodeAsset('end', 'endpoints', '入口 / 出口'),
    ],
  },
  data: {
    name: '数据处理',
    assets: [
      buildGatewayNodeAsset('data-definition', 'data', '数据处理'),
      buildGatewayNodeAsset('metadata', 'data', '数据处理'),
      buildGatewayNodeAsset('sql-query', 'data', '数据处理'),
    ],
  },
  flow: {
    name: '流程控制',
    assets: [
      buildGatewayNodeAsset('branch', 'flow', '流程控制'),
      buildLoopGroupAsset('flow', '流程控制'),
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
