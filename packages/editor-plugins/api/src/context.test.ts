import { describe, expect, it, vi } from 'vitest';
import {
  getPluginCommandAccess,
  getPluginDocumentAccess,
  getPluginFeedbackAccess,
  getPluginSelectionAccess,
  getPluginStorageAccess,
  getPluginWorkspaceAccess,
  type PluginContext,
} from './context';

describe('plugin context helpers', () => {
  it('prefers service-based schema and selection accessors', () => {
    const selectedNode = { id: 'node-1', component: 'Button' } as const;
    const context: PluginContext = {
      document: {
        getSchema: () => ({ id: 'page-1', body: [] }),
      },
      selection: {
        getSelectedNode: () => selectedNode,
        getSelectedNodeId: () => selectedNode.id,
      },
    };

    expect(getPluginDocumentAccess(context).getSchema()?.id).toBe('page-1');
    expect(getPluginSelectionAccess(context).getSelectedNode()).toBe(selectedNode);
    expect(getPluginSelectionAccess(context).getSelectedNodeId()).toBe('node-1');
  });

  it('exposes document patching from the document service', () => {
    const props = vi.fn();
    const style = vi.fn();
    const context: PluginContext = {
      document: {
        patchSelectedNode: {
          props,
          style,
        },
      },
    };

    const patchService = getPluginDocumentAccess(context).patchSelectedNode;

    expect(patchService?.props).toBe(props);
    expect(patchService?.style).toBe(style);
  });

  it('prefers service-based commands and notifications', () => {
    const execute = vi.fn();
    const success = vi.fn();
    const context: PluginContext = {
      commands: {
        execute,
      },
      notifications: {
        success,
      },
    };

    getPluginCommandAccess(context).execute('cmd.run', { ok: true });
    getPluginFeedbackAccess(context).notifications?.success?.('done');

    expect(execute).toHaveBeenCalledWith('cmd.run', { ok: true });
    expect(success).toHaveBeenCalledWith('done');
  });

  it('reports command availability through grouped command access', () => {
    expect(getPluginCommandAccess({ commands: { execute: vi.fn() } }).canExecute()).toBe(true);
    expect(getPluginCommandAccess({}).canExecute()).toBe(false);
  });

  it('replaceSchema delegates through the document service', () => {
    const replaceSchema = vi.fn();
    const handled = getPluginDocumentAccess(
      {
        document: {
          replaceSchema,
        },
      },
    ).replaceSchema({ id: 'page-2', body: [] });

    expect(handled).toBe(true);
    expect(replaceSchema).toHaveBeenCalledWith({ id: 'page-2', body: [] });
  });

  it('replacePluginSchema returns false when no replacement service exists', () => {
    const handled = getPluginDocumentAccess(
      {},
    ).replaceSchema({ id: 'page-3', body: [] });

    expect(handled).toBe(false);
  });

  it('exposes workspace and storage access through grouped helpers', () => {
    const getWorkspaceId = vi.fn(() => 'workspace-1');
    const persistence = {
      getJSON: vi.fn(),
      setJSON: vi.fn(),
      remove: vi.fn(),
    };
    const filesystem = {
      createFile: vi.fn(),
      readFile: vi.fn(),
      writeFile: vi.fn(),
    };
    const context: PluginContext = {
      workspace: { getWorkspaceId },
      persistence,
      filesystem,
    };

    expect(getPluginWorkspaceAccess(context).getWorkspaceId()).toBe('workspace-1');
    expect(getPluginStorageAccess(context).persistence).toBe(persistence);
    expect(getPluginStorageAccess(context).filesystem).toBe(filesystem);
  });

  it('exposes document and selection subscriptions through grouped helpers', () => {
    const documentSubscribe = vi.fn(() => () => undefined);
    const selectionSubscribe = vi.fn(() => () => undefined);
    const context: PluginContext = {
      document: {
        subscribe: documentSubscribe,
      },
      selection: {
        subscribe: selectionSubscribe,
      },
    };
    const documentListener = vi.fn();
    const selectionListener = vi.fn();

    const unsubscribeDocument = getPluginDocumentAccess(context).subscribe(documentListener);
    const unsubscribeSelection = getPluginSelectionAccess(context).subscribe(selectionListener);

    expect(documentSubscribe).toHaveBeenCalledWith(documentListener);
    expect(selectionSubscribe).toHaveBeenCalledWith(selectionListener);
    expect(typeof unsubscribeDocument).toBe('function');
    expect(typeof unsubscribeSelection).toBe('function');
  });
});
