import type { ComponentContract } from '../types/contract';
import { buttonContract } from './button';
import { cardContract } from './card';
import { formContract } from './form';
import { formItemContract } from './form-item';
import { inputContract } from './input';
import { modalContract } from './modal';
import { selectContract } from './select';
import { tableContract } from './table';

export * from './button';
export * from './card';
export * from './form';
export * from './form-item';
export * from './input';
export * from './modal';
export * from './select';
export * from './table';

export const builtinContracts: ComponentContract[] = [
  buttonContract,
  inputContract,
  selectContract,
  formContract,
  formItemContract,
  tableContract,
  modalContract,
  cardContract,
];

export const builtinContractMap: Record<string, ComponentContract> = Object.fromEntries(
  builtinContracts.map((contract) => [contract.componentType, contract]),
);

export function getBuiltinContract(componentType: string): ComponentContract | undefined {
  return builtinContractMap[componentType];
}
