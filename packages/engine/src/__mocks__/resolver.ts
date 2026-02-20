import type { ComponentType } from 'react';
import type { ComponentResolver } from '../types/contracts';
import { createResolver } from '../resolver';

export function createMockResolver(
  initialMap: Record<string, ComponentType<any>> = {},
): ComponentResolver {
  return createResolver(initialMap);
}
