import type { ComponentContract } from '@shenbi/schema';
import { isPortTypeCompatible } from '../validation';
import type {
  GatewayNode,
  PortDataType,
} from '../types';
import { getNodeContract, getContractInputs, getContractOutputs } from '../types';

function findTargetInputType(
  targetNode: GatewayNode | null,
  targetHandle?: string,
): PortDataType | undefined {
  if (!targetNode || !targetHandle) {
    return undefined;
  }

  const contract = getNodeContract(targetNode.data.kind);
  return getContractInputs(contract).find((port) => port.id === targetHandle)?.dataType;
}

export function resolveBridgeOutputHandle(
  contract: ComponentContract,
  targetNode: GatewayNode | null,
  targetHandle?: string,
): string | undefined {
  const outputs = getContractOutputs(contract);
  if (outputs.length === 0) {
    return undefined;
  }

  const targetInputType = findTargetInputType(targetNode, targetHandle);
  if (!targetInputType) {
    return outputs[0]?.id;
  }

  const exactMatch = outputs.find((port) => port.dataType === targetInputType);
  if (exactMatch) {
    return exactMatch.id;
  }

  const compatibleMatch = outputs.find((port) => (
    isPortTypeCompatible(port.dataType, targetInputType)
  ));
  return compatibleMatch?.id ?? outputs[0]?.id;
}
