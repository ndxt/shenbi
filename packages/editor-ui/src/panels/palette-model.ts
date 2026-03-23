export type PaletteAssetInsertKind = 'sidebar' | 'quick-insert' | 'edge-insert';

export interface PaletteDragPayload {
  kind: string;
  type: string;
  label: string;
  description?: string | undefined;
  icon?: string | undefined;
  meta?: Record<string, unknown> | undefined;
}

export interface PaletteItem {
  id: string;
  type: string;
  name: string;
  description?: string | undefined;
  icon?: string | undefined;
  color?: string | undefined;
  draggable?: boolean | undefined;
  insertable?: boolean | undefined;
  children?: PaletteItem[] | undefined;
  dragPayload: PaletteDragPayload;
}

export interface PaletteGroup {
  id: string;
  name: string;
  items: PaletteItem[];
}

export interface PaletteAssetVisibility extends Partial<Record<PaletteAssetInsertKind, boolean>> {}

export interface PaletteAsset {
  id: string;
  type: string;
  name: string;
  description?: string | undefined;
  icon?: string | undefined;
  color?: string | undefined;
  sourceType: string;
  groupId: string;
  groupName: string;
  dragPayload: PaletteDragPayload;
  draggable?: boolean | undefined;
  insertable?: boolean | undefined;
  visibility?: PaletteAssetVisibility | undefined;
  children?: PaletteAsset[] | undefined;
  /** Extra metadata consumed by specific renderers (e.g. gateway canvas) */
  extra?: Record<string, unknown> | undefined;
}

export interface PaletteAssetGroup {
  id: string;
  name: string;
  assets: PaletteAsset[];
}

function isAssetVisible(asset: PaletteAsset, insertKind: PaletteAssetInsertKind): boolean {
  return asset.visibility?.[insertKind] ?? true;
}

function filterAsset(
  asset: PaletteAsset,
  insertKind: PaletteAssetInsertKind,
): PaletteAsset | null {
  if (!isAssetVisible(asset, insertKind)) {
    return null;
  }

  const children = asset.children
    ?.map((child) => filterAsset(child, insertKind))
    .filter((child): child is PaletteAsset => child !== null);

  return {
    ...asset,
    ...(children ? { children } : {}),
  };
}

function mapAssetToItem(
  asset: PaletteAsset,
  insertKind: PaletteAssetInsertKind,
): PaletteItem | null {
  if (!isAssetVisible(asset, insertKind)) {
    return null;
  }

  const children = asset.children
    ?.map((child) => mapAssetToItem(child, insertKind))
    .filter((child): child is PaletteItem => child !== null);

  return {
    id: asset.id,
    type: asset.type,
    name: asset.name,
    ...(asset.description ? { description: asset.description } : {}),
    ...(asset.icon ? { icon: asset.icon } : {}),
    ...(asset.color ? { color: asset.color } : {}),
    ...(asset.draggable !== undefined ? { draggable: asset.draggable } : {}),
    ...(asset.insertable !== undefined ? { insertable: asset.insertable } : {}),
    ...(children && children.length > 0 ? { children } : {}),
    dragPayload: asset.dragPayload,
  };
}

export function buildPaletteGroupsFromAssetGroups(
  assetGroups: PaletteAssetGroup[],
  insertKind: PaletteAssetInsertKind = 'sidebar',
): PaletteGroup[] {
  return filterPaletteAssetGroupsByInsertKind(assetGroups, insertKind)
    .map((group) => ({
      id: group.id,
      name: group.name,
      items: group.assets
        .map((asset) => mapAssetToItem(asset, insertKind))
        .filter((item): item is PaletteItem => item !== null),
    }))
    .filter((group) => group.items.length > 0);
}

export function filterPaletteAssetGroupsByInsertKind(
  assetGroups: PaletteAssetGroup[],
  insertKind: PaletteAssetInsertKind,
): PaletteAssetGroup[] {
  return assetGroups
    .map((group) => ({
      ...group,
      assets: group.assets
        .map((asset) => filterAsset(asset, insertKind))
        .filter((asset): asset is PaletteAsset => asset !== null),
    }))
    .filter((group) => group.assets.length > 0);
}
