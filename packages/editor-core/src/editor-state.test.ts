import { describe, expect, it, vi } from 'vitest';
import type { PageSchema } from '@shenbi/schema';
import { EditorState } from './editor-state';

function createSchema(name: string): PageSchema {
  return {
    id: name,
    name,
    body: [],
  };
}

describe('EditorState', () => {
  it('updates schema and notifies subscribers', () => {
    const state = new EditorState(createSchema('initial'));
    const listener = vi.fn();
    state.subscribe(listener);

    state.setSchema(createSchema('next'));

    expect(state.getSchema().name).toBe('next');
    expect(listener).toHaveBeenCalled();
  });

  it('supports snapshot restore with history flags', () => {
    const state = new EditorState(createSchema('initial'));
    state.setSelectedNodeId('body.0');
    state.setCurrentFileId('demo');
    state.setDirty(true);
    state.setHistoryFlags(true, false);
    const snapshot = state.getSnapshot();

    state.setSchema(createSchema('changed'));
    state.setSelectedNodeId(undefined);
    state.setCurrentFileId(undefined);
    state.setDirty(false);
    state.setHistoryFlags(false, false);
    state.restoreSnapshot(snapshot);

    const restored = state.getSnapshot();
    expect(restored.schema.name).toBe('initial');
    expect(restored.selectedNodeId).toBe('body.0');
    expect(restored.currentFileId).toBe('demo');
    expect(restored.isDirty).toBe(true);
    expect(restored.canUndo).toBe(true);
    expect(restored.canRedo).toBe(false);
  });
});
