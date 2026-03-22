import type { EditorStateSnapshot } from '@shenbi/editor-core';
import {
  cloneSchema,
  cloneSchemaNodeWithFreshIds,
  canSchemaNodeAcceptCanvasChildren as canSchemaNodeAcceptCanvasChildrenBase,
  getContainerNodeCount,
  getTreeArrayPosition,
  hasSchemaContent,
  resolveCanvasDropPosition as resolveCanvasDropPositionBase,
} from '@shenbi/editor-core';
import { isCommandBlockedDuringGeneration } from '@shenbi/editor-ui';
import { getBuiltinContract } from '@shenbi/schema';
import type { PageSchema } from '@shenbi/schema';
import {
  descriptionsSkeletonSchema,
  drawerDetailSkeletonSchema,
  formListSkeletonSchema,
  nineGridSkeletonSchema,
  tabsDetailSkeletonSchema,
  treeManagementSkeletonSchema,
  userManagementSchema,
} from '../schemas';
import type { ScenarioKey } from '../preview-types';

export {
  cloneSchema,
  cloneSchemaNodeWithFreshIds,
  getContainerNodeCount,
  getTreeArrayPosition,
  hasSchemaContent,
};

export function canSchemaNodeAcceptCanvasChildren(schema: PageSchema, schemaNodeId: string | undefined) {
  return canSchemaNodeAcceptCanvasChildrenBase(schema, schemaNodeId, getBuiltinContract);
}

export function resolveCanvasDropPosition(
  schema: PageSchema,
  target: import('@shenbi/editor-core').SchemaNodeDropTarget,
) {
  return resolveCanvasDropPositionBase(schema, target, getBuiltinContract);
}

export function createInitialScenarioState(): Record<ScenarioKey, PageSchema> {
  return {
    'user-management': cloneSchema(userManagementSchema),
    'form-list': cloneSchema(formListSkeletonSchema),
    'tabs-detail': cloneSchema(tabsDetailSkeletonSchema),
    'tree-management': cloneSchema(treeManagementSkeletonSchema),
    descriptions: cloneSchema(descriptionsSkeletonSchema),
    'drawer-detail': cloneSchema(drawerDetailSkeletonSchema),
    'nine-grid': cloneSchema(nineGridSkeletonSchema),
  };
}

export function createScenarioSnapshot(schema: PageSchema): EditorStateSnapshot {
  return {
    schema,
    isDirty: false,
    canUndo: false,
    canRedo: false,
  };
}

export function createInitialScenarioSnapshots(): Record<ScenarioKey, EditorStateSnapshot> {
  const schemas = createInitialScenarioState();
  return {
    'user-management': createScenarioSnapshot(schemas['user-management']),
    'form-list': createScenarioSnapshot(schemas['form-list']),
    'tabs-detail': createScenarioSnapshot(schemas['tabs-detail']),
    'tree-management': createScenarioSnapshot(schemas['tree-management']),
    descriptions: createScenarioSnapshot(schemas.descriptions),
    'drawer-detail': createScenarioSnapshot(schemas['drawer-detail']),
    'nine-grid': createScenarioSnapshot(schemas['nine-grid']),
  };
}

export function createEmptyShellSchema(): PageSchema {
  return {
    id: 'shell-page',
    body: [],
  };
}

export function isBlockedDuringGeneration(commandId: string): boolean {
  return isCommandBlockedDuringGeneration(commandId);
}
