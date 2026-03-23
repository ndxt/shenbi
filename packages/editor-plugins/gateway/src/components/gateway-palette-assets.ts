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
    name: '数据处理',
    assets: [
      buildGatewayNodeAsset(gatewayContractByKind['data-definition']!, 'data', '数据处理'),
      buildGatewayNodeAsset(gatewayContractByKind['metadata']!, 'data', '数据处理'),
      buildGatewayNodeAsset(gatewayContractByKind['sql-query']!, 'data', '数据处理'),
    ],
  },
  flow: {
    name: '流程控制',
    assets: [
      buildGatewayNodeAsset(gatewayContractByKind['branch']!, 'flow', '流程控制'),
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
