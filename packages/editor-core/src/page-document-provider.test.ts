import { describe, expect, it } from 'vitest';
import { TabManager } from './tab-manager';
import { createEditor } from './create-editor';
import { PageDocumentProvider } from './page-document-provider';

describe('PageDocumentProvider', () => {
  it('reflects page command history and document state for the active tab', async () => {
    const editor = createEditor({
      tabManager: new TabManager(),
      projectId: 'test-project',
      vfs: {
        initialize: async () => undefined,
        listTree: async () => [],
        createFile: async () => {
          throw new Error('not implemented');
        },
        readFile: async () => ({
          id: 'page-1',
          name: 'page-1',
          body: [],
        }),
        writeFile: async () => undefined,
        deleteFile: async () => undefined,
        createDirectory: async () => {
          throw new Error('not implemented');
        },
        deleteDirectory: async () => undefined,
        rename: async () => {
          throw new Error('not implemented');
        },
        move: async () => {
          throw new Error('not implemented');
        },
        getNode: async () => ({
          id: 'page-1',
          name: 'page-1',
          type: 'file',
          fileType: 'page',
          path: '/page-1.page.json',
          updatedAt: Date.now(),
        }),
        getNodeByPath: async () => undefined,
      },
    });

    await editor.commands.execute('tab.open', { fileId: 'page-1' });

    const provider = new PageDocumentProvider({
      fileId: 'page-1',
      state: editor.state,
      commands: editor.commands,
    });

    expect(provider.getState()).toMatchObject({
      fileId: 'page-1',
      fileType: 'page',
      isDirty: false,
      canUndo: false,
      canRedo: false,
    });

    await editor.commands.execute('schema.replace', {
      schema: {
        id: 'page-1',
        name: 'page-1',
        body: [
          { id: 'node-1', component: 'Container', props: {}, children: [] },
        ],
      },
    });

    expect(provider.getState()).toMatchObject({
      isDirty: true,
      canUndo: true,
      canRedo: false,
    });
    expect(provider.getDocument()).toMatchObject({
      id: 'page-1',
      body: [{ id: 'node-1' }],
    });

    provider.undo();
    await Promise.resolve();

    expect(provider.getState()).toMatchObject({
      canUndo: false,
      canRedo: true,
    });

    provider.dispose();
    editor.destroy();
  });
});
