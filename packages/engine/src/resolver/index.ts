import { Fragment, type ComponentType } from 'react';
import type { ComponentResolver } from '../types/contracts';

function resolveFromDotPath(source: Record<string, any>, path: string): any {
  return path.split('.').reduce((acc, key) => acc?.[key], source);
}

export function createResolver(
  initialMap: Record<string, ComponentType<any>> = {},
): ComponentResolver {
  const components: Record<string, ComponentType<any>> = { ...initialMap };

  return {
    resolve(componentType: string) {
      if (componentType === '__fragment') {
        return Fragment;
      }

      if (components[componentType]) {
        return components[componentType];
      }

      if (componentType.includes('.')) {
        const [root] = componentType.split('.');
        if (root && components[root]) {
          return resolveFromDotPath(components, componentType) ?? null;
        }
      }

      return null;
    },
    register(componentType: string, component: ComponentType<any>) {
      components[componentType] = component;
    },
    registerAll(map: Record<string, ComponentType<any>>) {
      Object.assign(components, map);
    },
    has(componentType: string) {
      return this.resolve(componentType) !== null;
    },
  };
}
