import { isPortTypeCompatible } from '../validation';
import {
  NODE_CONTRACTS,
  type GatewayNode,
  type GatewayNodeContract,
  type PortDataType,
} from '../types';

function findTargetInputType(
  targetNode: GatewayNode | null,
  targetHandle?: string,
): PortDataType | undefined {
  if (!targetNode || !targetHandle) {
    return undefined;
  }

  const contract = NODE_CONTRACTS[targetNode.data.kind];
  return contract.inputs.find((port) => port.id === targetHandle)?.dataType;
}

export function resolveBridgeOutputHandle(
  contract: GatewayNodeContract,
  targetNode: GatewayNode | null,
  targetHandle?: string,
): string | undefined {
  if (contract.outputs.length === 0) {
    return undefined;
  }

  const targetInputType = findTargetInputType(targetNode, targetHandle);
  if (!targetInputType) {
    return contract.outputs[0]?.id;
  }

  const exactMatch = contract.outputs.find((port) => port.dataType === targetInputType);
  if (exactMatch) {
    return exactMatch.id;
  }

  const compatibleMatch = contract.outputs.find((port) => (
    isPortTypeCompatible(port.dataType, targetInputType)
  ));
  return compatibleMatch?.id ?? contract.outputs[0]?.id;
}
