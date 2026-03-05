import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { PageSchema } from '@shenbi/schema';
import type { EditorStateSnapshot } from '@shenbi/editor-core';
import { useEditorSession, type EditorSessionEditor } from './useEditorSession';

function createSchema(name: string): PageSchema {
  return {
    id: name,
    name,
    body: [],
  };
}

interface FakeEditorController {
  editor: EditorSessionEditor;
  execute: ReturnType<typeof vi.fn>;
  destroy: ReturnType<typeof vi.fn>;
}

function createFakeEditor(initialSchema: PageSchema): FakeEditorController {
  let schema = initialSchema;
  let selectedNodeId: string | undefined;
  const listeners = new Set<(snapshot: EditorStateSnapshot) => void>();
  const getSnapshot = (): EditorStateSnapshot => ({
    schema,
    ...(selectedNodeId ? { selectedNodeId } : {}),
    isDirty: false,
    canUndo: false,
    canRedo: false,
  });
  const notify = (): void => {
    const snapshot = getSnapshot();
    for (const listener of listeners) {
      listener(snapshot);
    }
  };

  const execute = vi.fn(async (commandId: string, args?: unknown) => {
    if (commandId === 'schema.replace') {
      schema = (args as { schema: PageSchema }).schema;
      notify();
      return undefined;
    }
    return undefined;
  });
  const destroy = vi.fn();

  return {
    execute,
    destroy,
    editor: {
      state: {
        getSnapshot,
        getSchema: () => schema,
        setSelectedNodeId(nextNodeId) {
          selectedNodeId = nextNodeId;
          notify();
        },
        subscribe(listener) {
          listeners.add(listener);
          return () => {
            listeners.delete(listener);
          };
        },
      },
      commands: { execute },
      destroy,
    },
  };
}

describe('useEditorSession', () => {
  it('shell 模式下 updateActiveSchema 会走 schema.replace', async () => {
    const fake = createFakeEditor(createSchema('initial'));
    const updateScenarioSchema = vi.fn();
    const { result } = renderHook(() => useEditorSession({
      mode: 'shell',
      initialShellSchema: createSchema('initial'),
      updateScenarioSchema,
      createEditorInstance: () => fake.editor,
    }));

    act(() => {
      result.current.updateActiveSchema(() => createSchema('next'));
    });

    await waitFor(() => {
      expect(fake.execute).toHaveBeenCalledWith('schema.replace', { schema: createSchema('next') });
    });
    expect(updateScenarioSchema).not.toHaveBeenCalled();
  });

  it('scenarios 模式下 updateActiveSchema 会走场景更新回调', () => {
    const fake = createFakeEditor(createSchema('initial'));
    const updateScenarioSchema = vi.fn();
    const { result } = renderHook(() => useEditorSession({
      mode: 'scenarios',
      initialShellSchema: createSchema('initial'),
      updateScenarioSchema,
      createEditorInstance: () => fake.editor,
    }));

    act(() => {
      result.current.updateActiveSchema(() => createSchema('scenario-next'));
    });

    expect(updateScenarioSchema).toHaveBeenCalledTimes(1);
    expect(fake.execute).not.toHaveBeenCalledWith('schema.replace', expect.anything());
  });

  it('setShellSelectedNodeId 会同步到 shellSnapshot', async () => {
    const fake = createFakeEditor(createSchema('initial'));
    const { result } = renderHook(() => useEditorSession({
      mode: 'shell',
      initialShellSchema: createSchema('initial'),
      updateScenarioSchema: vi.fn(),
      createEditorInstance: () => fake.editor,
    }));

    act(() => {
      result.current.setShellSelectedNodeId('tree-card');
    });

    await waitFor(() => {
      expect(result.current.shellSnapshot.selectedNodeId).toBe('tree-card');
    });
  });

  it('卸载时会调用 editor.destroy', () => {
    const fake = createFakeEditor(createSchema('initial'));
    const view = renderHook(() => useEditorSession({
      mode: 'shell',
      initialShellSchema: createSchema('initial'),
      updateScenarioSchema: vi.fn(),
      createEditorInstance: () => fake.editor,
    }));

    view.unmount();
    expect(fake.destroy).toHaveBeenCalledTimes(1);
  });
});
