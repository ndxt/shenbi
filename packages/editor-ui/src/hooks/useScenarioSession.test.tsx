import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { PageSchema } from '@shenbi/schema';
import type { EditorStateSnapshot, FileMetadata, FileStorageAdapter } from '@shenbi/editor-core';
import { useScenarioSession } from './useScenarioSession';

type ScenarioKey = 'users' | 'orders';

function createSchema(name: string): PageSchema {
  return {
    id: name,
    name,
    body: [],
  };
}

function createNestedSchema(name: string): PageSchema {
  return {
    id: name,
    name,
    body: [
      {
        id: 'root',
        component: 'Container',
        children: [
          { id: 'first', component: 'Button' },
          { id: 'second', component: 'Button' },
        ],
      },
    ],
  };
}

function createSnapshot(name: string): EditorStateSnapshot {
  return {
    schema: createSchema(name),
    isDirty: false,
    canUndo: false,
    canRedo: false,
  };
}

function createStorage(): FileStorageAdapter {
  const files = new Map<string, PageSchema>();
  return {
    async list(): Promise<FileMetadata[]> {
      return Array.from(files.entries()).map(([id, schema]) => ({
        id,
        name: schema.name ?? id,
        updatedAt: 1,
      }));
    },
    async read(fileId: string): Promise<PageSchema> {
      const schema = files.get(fileId);
      if (!schema) {
        throw new Error(`missing file: ${fileId}`);
      }
      return schema;
    },
    async write(fileId: string, schema: PageSchema): Promise<void> {
      files.set(fileId, schema);
    },
    async saveAs(name: string, schema: PageSchema): Promise<string> {
      const fileId = `file:${name}`;
      files.set(fileId, schema);
      return fileId;
    },
  };
}

describe('useScenarioSession', () => {
  it('updateScenarioSchema 会更新当前场景并推进 undo 状态', async () => {
    const { result } = renderHook(() => useScenarioSession<ScenarioKey>({
      activeScenario: 'users',
      initialSnapshots: {
        users: createSnapshot('users'),
        orders: createSnapshot('orders'),
      },
    }));

    act(() => {
      result.current.updateScenarioSchema(() => createSchema('users-next'));
    });

    await waitFor(() => {
      expect(result.current.activeScenarioSnapshot.schema.name).toBe('users-next');
      expect(result.current.activeScenarioSnapshot.isDirty).toBe(true);
      expect(result.current.activeScenarioSnapshot.canUndo).toBe(true);
    });
    expect(result.current.scenarioSnapshots.orders.schema.name).toBe('orders');
  });

  it('executeScenarioCommand 支持 undo/redo', async () => {
    const { result } = renderHook(() => useScenarioSession<ScenarioKey>({
      activeScenario: 'users',
      initialSnapshots: {
        users: createSnapshot('users'),
        orders: createSnapshot('orders'),
      },
    }));

    act(() => {
      result.current.updateScenarioSchema(() => createSchema('users-next'));
    });

    await act(async () => {
      await result.current.executeScenarioCommand('editor.undo');
    });

    expect(result.current.activeScenarioSnapshot.schema.name).toBe('users');
    expect(result.current.activeScenarioSnapshot.canRedo).toBe(true);

    await act(async () => {
      await result.current.executeScenarioCommand('editor.redo');
    });

    expect(result.current.activeScenarioSnapshot.schema.name).toBe('users-next');
  });

  it('executeScenarioCommand 支持 saveAs/open/save', async () => {
    const storage = createStorage();
    const { result } = renderHook(() => useScenarioSession<ScenarioKey>({
      activeScenario: 'users',
      initialSnapshots: {
        users: createSnapshot('users'),
        orders: createSnapshot('orders'),
      },
      fileStorage: storage,
    }));

    act(() => {
      result.current.updateScenarioSchema(() => createSchema('users-saved'));
    });

    await act(async () => {
      await result.current.executeScenarioCommand('file.saveAs', { name: 'users-demo' });
    });

    expect(result.current.activeScenarioSnapshot.currentFileId).toBe('file:users-demo');
    expect(result.current.activeScenarioSnapshot.isDirty).toBe(false);

    act(() => {
      result.current.updateScenarioSchema(() => createSchema('users-edited-again'));
    });

    await act(async () => {
      await result.current.executeScenarioCommand('file.saveSchema');
      await result.current.executeScenarioCommand('file.openSchema', { fileId: 'file:users-demo' });
    });

    expect(result.current.activeScenarioSnapshot.schema.name).toBe('users-edited-again');
    expect(result.current.activeScenarioSnapshot.currentFileId).toBe('file:users-demo');
    expect(result.current.activeScenarioSnapshot.isDirty).toBe(false);
  });

  it('setScenarioSelectedNodeId 只更新当前场景选择', () => {
    const { result } = renderHook(() => useScenarioSession<ScenarioKey>({
      activeScenario: 'users',
      initialSnapshots: {
        users: createSnapshot('users'),
        orders: createSnapshot('orders'),
      },
    }));

    act(() => {
      result.current.setScenarioSelectedNodeId('body.0');
    });

    expect(result.current.activeScenarioSnapshot.selectedNodeId).toBe('body.0');
    expect(result.current.scenarioSnapshots.orders.selectedNodeId).toBeUndefined();
  });

  it('executeScenarioCommand 支持 node.insertAt / node.remove / node.move', async () => {
    const { result } = renderHook(() => useScenarioSession<ScenarioKey>({
      activeScenario: 'users',
      initialSnapshots: {
        users: {
          schema: createNestedSchema('users'),
          isDirty: false,
          canUndo: false,
          canRedo: false,
          selectedNodeId: 'body.0.children.0',
        },
        orders: createSnapshot('orders'),
      },
    }));

    await act(async () => {
      await result.current.executeScenarioCommand('node.insertAt', {
        parentTreeId: 'body.0',
        index: 1,
        node: {
          id: 'inserted',
          component: 'Button',
        },
      });
    });

    expect(
      (result.current.activeScenarioSnapshot.schema.body as any[])[0].children.map((node: { id: string }) => node.id),
    ).toEqual(['first', 'inserted', 'second']);

    await act(async () => {
      await result.current.executeScenarioCommand('node.move', {
        sourceTreeId: 'body.0.children.0',
        targetParentTreeId: 'body.0',
        index: 3,
      });
    });

    expect(
      (result.current.activeScenarioSnapshot.schema.body as any[])[0].children.map((node: { id: string }) => node.id),
    ).toEqual(['inserted', 'second', 'first']);
    expect(result.current.activeScenarioSnapshot.selectedNodeId).toBe('body.0.children.2');

    await act(async () => {
      await result.current.executeScenarioCommand('node.remove', {
        treeId: 'body.0.children.2',
      });
    });

    expect(
      (result.current.activeScenarioSnapshot.schema.body as any[])[0].children.map((node: { id: string }) => node.id),
    ).toEqual(['inserted', 'second']);
    expect(result.current.activeScenarioSnapshot.selectedNodeId).toBeUndefined();
  });
});
