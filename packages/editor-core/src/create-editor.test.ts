import { describe, expect, it, vi } from 'vitest';
import type { PageSchema } from '@shenbi/schema';
import { createEditor } from './create-editor';
import type { FileMetadata, FileStorageAdapter } from './adapters/file-storage';
import type { VirtualFileSystemAdapter } from './adapters/virtual-fs';
import { TabManager } from './tab-manager';

function createSchema(name: string): PageSchema {
  return {
    id: name,
    name,
    body: [],
  };
}

function createSchemaWithCard(name: string): PageSchema {
  return {
    id: `${name}-id`,
    name,
    body: [
      {
        id: 'card-1',
        component: 'Card',
        props: { title: 'old-title' },
      },
    ],
  };
}

function createSchemaWithContainer(name: string): PageSchema {
  return {
    id: `${name}-id`,
    name,
    body: {
      id: 'container-1',
      component: 'Container',
      children: [],
    },
  };
}

function createMemoryStorage(initial: PageSchema = createSchema('loaded')): FileStorageAdapter {
  const files = new Map<string, PageSchema>([['demo', initial]]);
  return {
    async list(): Promise<FileMetadata[]> {
      return Array.from(files.entries()).map(([id, schema]) => ({
        id,
        name: schema.name ?? id,
        updatedAt: Date.now(),
      }));
    },
    async read(fileId: string): Promise<PageSchema> {
      const found = files.get(fileId);
      if (!found) {
        throw new Error(`missing file: ${fileId}`);
      }
      return found;
    },
    async write(fileId: string, schema: PageSchema): Promise<void> {
      files.set(fileId, schema);
    },
    async saveAs(name: string, schema: PageSchema): Promise<string> {
      const id = `id-${name}`;
      files.set(id, { ...schema, name });
      return id;
    },
    async delete(fileId: string): Promise<void> {
      files.delete(fileId);
    },
  };
}

function createMemoryVFS(initialSchema: PageSchema = createSchema('loaded')): VirtualFileSystemAdapter {
  const nodes = new Map([
    ['demo', {
      id: 'demo',
      name: initialSchema.name ?? 'demo',
      type: 'file' as const,
      fileType: 'page' as const,
      parentId: null,
      path: '/demo.page.json',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }],
  ]);
  const contents = new Map<string, PageSchema>([['demo', initialSchema]]);

  return {
    async initialize() {
      return undefined;
    },
    async listTree() {
      return [...nodes.values()];
    },
    async createFile(_projectId, parentId, name, fileType, content) {
      const node = {
        id: `file-${name}`,
        name,
        type: 'file' as const,
        fileType,
        parentId,
        path: `/${name}.page.json`,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      nodes.set(node.id, node);
      contents.set(node.id, content as PageSchema);
      return node;
    },
    async readFile(_projectId, fileId) {
      const content = contents.get(fileId);
      if (!content) {
        throw new Error(`missing file: ${fileId}`);
      }
      return content;
    },
    async writeFile(_projectId, fileId, content) {
      contents.set(fileId, content as PageSchema);
      const node = nodes.get(fileId);
      if (node) {
        node.updatedAt = Date.now();
      }
    },
    async deleteFile(_projectId, fileId) {
      nodes.delete(fileId);
      contents.delete(fileId);
    },
    async createDirectory(_projectId, parentId, name) {
      const node = {
        id: `dir-${name}`,
        name,
        type: 'directory' as const,
        parentId,
        path: `/${name}`,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      nodes.set(node.id, node);
      return node;
    },
    async deleteDirectory() {
      return undefined;
    },
    async rename(_projectId, nodeId, newName) {
      const node = nodes.get(nodeId);
      if (!node) {
        throw new Error(`missing node: ${nodeId}`);
      }
      node.name = newName;
      return node;
    },
    async move(_projectId, nodeId, newParentId) {
      const node = nodes.get(nodeId);
      if (!node) {
        throw new Error(`missing node: ${nodeId}`);
      }
      node.parentId = newParentId;
      return node;
    },
    async getNode(_projectId, nodeId) {
      return nodes.get(nodeId);
    },
    async getNodeByPath(_projectId, path) {
      return [...nodes.values()].find((node) => node.path === path);
    },
  };
}

describe('createEditor', () => {
  it('registers builtin commands', () => {
    const editor = createEditor();
    expect(editor.commands.has('schema.replace')).toBe(true);
    expect(editor.commands.has('schema.restore')).toBe(true);
    expect(editor.commands.has('node.append')).toBe(true);
    expect(editor.commands.has('node.insertAt')).toBe(true);
    expect(editor.commands.has('node.remove')).toBe(true);
    expect(editor.commands.has('node.patchProps')).toBe(true);
    expect(editor.commands.has('node.patchEvents')).toBe(true);
    expect(editor.commands.has('node.patchStyle')).toBe(true);
    expect(editor.commands.has('node.patchLogic')).toBe(true);
    expect(editor.commands.has('node.patchColumns')).toBe(true);
    expect(editor.commands.has('history.beginBatch')).toBe(true);
    expect(editor.commands.has('history.commitBatch')).toBe(true);
    expect(editor.commands.has('history.discardBatch')).toBe(true);
    expect(editor.commands.has('editor.restoreSnapshot')).toBe(true);
    expect(editor.commands.has('file.listSchemas')).toBe(true);
    expect(editor.commands.has('file.openSchema')).toBe(true);
    expect(editor.commands.has('file.readSchema')).toBe(true);
    expect(editor.commands.has('file.saveSchema')).toBe(true);
    expect(editor.commands.has('file.writeSchema')).toBe(true);
    expect(editor.commands.has('file.deleteSchema')).toBe(true);
    expect(editor.commands.has('editor.undo')).toBe(true);
    expect(editor.commands.has('editor.redo')).toBe(true);
  });

  it('schema.replace validates input', async () => {
    const editor = createEditor();
    await expect(editor.commands.execute('schema.replace', {})).rejects.toThrow('expects args');
    await expect(
      editor.commands.execute('schema.replace', { schema: { id: 1, body: [] } }),
    ).rejects.toThrow('schema.id must be a string');
  });

  it('file.openSchema updates state and records only one history snapshot', async () => {
    const editor = createEditor({
      initialSchema: createSchema('initial'),
      fileStorage: createMemoryStorage(createSchema('opened')),
    });
    const commandEvents: string[] = [];
    editor.eventBus.on('command:executed', ({ commandId }) => {
      commandEvents.push(commandId);
    });

    await editor.commands.execute('file.openSchema', { fileId: 'demo' });

    expect(editor.state.getSchema().name).toBe('opened');
    expect(editor.state.getCurrentFileId()).toBe('demo');
    expect(editor.state.getIsDirty()).toBe(false);
    expect(editor.history.getSize()).toBe(1);
    // nested command still emits its executed event.
    expect(commandEvents).toEqual(['schema.replace', 'file.openSchema']);
  });

  it('file.saveSchema does not mutate history but emits file:saved', async () => {
    const storage = createMemoryStorage();
    const editor = createEditor({
      initialSchema: createSchema('save-target'),
      fileStorage: storage,
    });
    const saved = vi.fn();
    editor.eventBus.on('file:saved', saved);

    await editor.commands.execute('file.saveSchema', { fileId: 'demo' });

    expect(saved).toHaveBeenCalledWith({ fileId: 'demo' });
    expect(editor.state.getCurrentFileId()).toBe('demo');
    expect(editor.state.getIsDirty()).toBe(false);
    expect(editor.history.getSize()).toBe(0);
  });

  it('uses in-memory file storage by default instead of localStorage', async () => {
    const localStorageRef = globalThis.localStorage;
    localStorageRef?.removeItem('shenbi-editor-files');
    const editor = createEditor({
      initialSchema: createSchema('memory-default'),
    });

    const fileId = await editor.commands.execute('file.saveAs', { name: '内存页面' });
    const files = await editor.commands.execute('file.listSchemas') as FileMetadata[];

    expect(fileId).toMatch(/^page-/);
    expect(files.map((file) => file.name)).toContain('内存页面');
    expect(localStorageRef?.getItem('shenbi-editor-files') ?? null).toBeNull();
  });

  it('file.listSchemas returns metadata and does not mutate history', async () => {
    const storage = createMemoryStorage(createSchema('demo-page'));
    const editor = createEditor({
      initialSchema: createSchema('list-target'),
      fileStorage: storage,
    });

    const result = await editor.commands.execute('file.listSchemas');
    expect(Array.isArray(result)).toBe(true);
    const metadataList = result as FileMetadata[];
    expect(metadataList.length).toBeGreaterThan(0);
    expect(metadataList[0]).toHaveProperty('id');
    expect(metadataList[0]).toHaveProperty('name');
    expect(editor.history.getSize()).toBe(0);
  });

  it('file.readSchema returns schema without mutating editor state', async () => {
    const source = createSchema('read-target');
    const storage = createMemoryStorage(source);
    const editor = createEditor({
      initialSchema: createSchema('current-page'),
      fileStorage: storage,
    });

    const result = await editor.commands.execute('file.readSchema', { fileId: 'demo' });

    expect(result).toEqual(source);
    expect(editor.state.getSchema().name).toBe('current-page');
    expect(editor.history.getSize()).toBe(0);
  });

  it('file.writeSchema writes schema without mutating editor state and emits auto file:saved plus fs:treeChanged', async () => {
    const storage = createMemoryStorage();
    const editor = createEditor({
      initialSchema: createSchema('current-page'),
      fileStorage: storage,
    });
    const saved = vi.fn();
    const treeChanged = vi.fn();
    editor.eventBus.on('file:saved', saved);
    editor.eventBus.on('fs:treeChanged', treeChanged);
    const backgroundSchema = createSchema('background-page');

    await editor.commands.execute('file.writeSchema', {
      fileId: 'background',
      schema: backgroundSchema,
    });

    await expect(storage.read('background')).resolves.toEqual(backgroundSchema);
    expect(editor.state.getSchema().name).toBe('current-page');
    expect(editor.state.getCurrentFileId()).toBeUndefined();
    expect(editor.history.getSize()).toBe(0);
    expect(saved).toHaveBeenCalledWith({ fileId: 'background', source: 'auto' });
    expect(treeChanged).toHaveBeenCalled();
  });

  it('trims file command args for fileId/name', async () => {
    const storage = createMemoryStorage();
    const editor = createEditor({
      initialSchema: createSchema('trim-target'),
      fileStorage: storage,
    });
    const saved = vi.fn();
    editor.eventBus.on('file:saved', saved);

    await editor.commands.execute('file.saveSchema', { fileId: '  demo  ' });
    expect(saved).toHaveBeenCalledWith({ fileId: 'demo' });

    const saveAsResult = await editor.commands.execute('file.saveAs', { name: '  Trim Name  ' });
    expect(saved).toHaveBeenCalled();
    expect(saveAsResult).toBe('id-Trim Name');
    expect(editor.state.getCurrentFileId()).toBe('id-Trim Name');
    expect(editor.state.getIsDirty()).toBe(false);
  });

  it('file.saveSchema can save by current file id without args', async () => {
    const storage = createMemoryStorage();
    const editor = createEditor({
      initialSchema: createSchema('save-by-current'),
      fileStorage: storage,
    });

    await editor.commands.execute('file.openSchema', { fileId: 'demo' });
    await editor.commands.execute('file.saveSchema');

    expect(editor.state.getCurrentFileId()).toBe('demo');
  });

  it('file.saveSchema without current file throws explicit error', async () => {
    const storage = createMemoryStorage();
    const editor = createEditor({
      initialSchema: createSchema('no-current-file'),
      fileStorage: storage,
    });

    await expect(editor.commands.execute('file.saveSchema')).rejects.toThrow(
      'requires current file',
    );
  });

  it('file.open/saveAs emits file:currentChanged', async () => {
    const storage = createMemoryStorage();
    const editor = createEditor({
      initialSchema: createSchema('current-changed'),
      fileStorage: storage,
    });
    const changed = vi.fn();
    editor.eventBus.on('file:currentChanged', changed);

    await editor.commands.execute('file.openSchema', { fileId: 'demo' });
    await editor.commands.execute('file.saveAs', { name: 'new-page' });

    expect(changed).toHaveBeenCalledWith({ fileId: 'demo' });
    expect(changed).toHaveBeenCalledWith({ fileId: 'id-new-page' });
  });

  it('file.deleteSchema removes file and emits file:deleted', async () => {
    const storage = createMemoryStorage(createSchema('delete-target'));
    const editor = createEditor({
      initialSchema: createSchema('current-page'),
      fileStorage: storage,
    });
    const deleted = vi.fn();
    editor.eventBus.on('file:deleted', deleted);

    await editor.commands.execute('file.deleteSchema', { fileId: 'demo' });

    await expect(storage.read('demo')).rejects.toThrow(/missing file/i);
    expect(deleted).toHaveBeenCalledWith({ fileId: 'demo' });
    expect(editor.history.getSize()).toBe(0);
  });

  it('registers tab commands when tab manager is configured', () => {
    const editor = createEditor({
      tabManager: new TabManager(),
      vfs: createMemoryVFS(),
      projectId: 'project-1',
    });

    expect(editor.commands.has('tab.open')).toBe(true);
    expect(editor.commands.has('tab.close')).toBe(true);
    expect(editor.commands.has('tab.closeOthers')).toBe(true);
    expect(editor.commands.has('tab.closeAll')).toBe(true);
    expect(editor.commands.has('tab.closeSaved')).toBe(true);
    expect(editor.commands.has('tab.save')).toBe(true);
  });

  it('uses VFS-backed file commands when VFS is configured', async () => {
    const vfs = createMemoryVFS(createSchema('page-a'));
    const editor = createEditor({
      initialSchema: createSchema('empty'),
      vfs,
      projectId: 'project-1',
    });

    const created = await editor.commands.execute('fs.createFile', {
      parentId: null,
      name: '订单列表页',
      fileType: 'page',
      content: createSchema('订单列表页'),
    }) as { id: string };

    const files = await editor.commands.execute('file.listSchemas') as FileMetadata[];
    expect(files.map((file) => file.name)).toContain('订单列表页');

    await editor.commands.execute('file.writeSchema', {
      fileId: created.id,
      schema: createSchema('订单列表页-v2'),
    });

    await expect(editor.commands.execute('file.readSchema', { fileId: created.id })).resolves.toMatchObject({
      name: '订单列表页-v2',
    });
  });

  it('tab.save writes VFS content and clears dirty state', async () => {
    const initial = createSchema('vfs-loaded');
    const vfs = createMemoryVFS(initial);
    const tabManager = new TabManager();
    const editor = createEditor({
      initialSchema: initial,
      tabManager,
      vfs,
      projectId: 'project-1',
    });

    await editor.commands.execute('tab.open', { fileId: 'demo' });
    await editor.commands.execute('schema.replace', { schema: createSchema('changed-page') });
    await editor.commands.execute('tab.save', { source: 'auto' });

    expect(await vfs.readFile('project-1', 'demo')).toMatchObject({ name: 'changed-page' });
    expect(editor.state.getIsDirty()).toBe(false);
    expect(tabManager.getTab('demo')?.isDirty).toBe(false);
  });

  it('keeps active tab snapshot in sync with editor state and closes saved tabs through command flow', async () => {
    const vfs = createMemoryVFS(createSchema('page-a'));
    const tabManager = new TabManager();
    const editor = createEditor({
      initialSchema: createSchema('empty'),
      tabManager,
      vfs,
      projectId: 'project-1',
    });

    await editor.commands.execute('tab.open', { fileId: 'demo' });
    tabManager.openTab('dirty-tab', {
      filePath: '/dirty-tab.page.json',
      fileType: 'page',
      fileName: 'dirty-tab',
      schema: createSchema('dirty-tab'),
      selectedNodeId: 'dirty-node',
      isDirty: true,
    });
    tabManager.activateTab('demo');
    editor.state.setSelectedNodeId('node-1');
    await editor.commands.execute('schema.replace', { schema: createSchema('updated-page-a') });

    expect(tabManager.getTab('demo')).toMatchObject({
      selectedNodeId: 'node-1',
      isDirty: true,
    });

    await editor.commands.execute('tab.closeSaved');

    expect(tabManager.getTabs().map((tab) => tab.fileId)).toEqual(['demo', 'dirty-tab']);

    await editor.commands.execute('tab.save');
    await editor.commands.execute('tab.closeSaved');

    expect(tabManager.getTabs().map((tab) => tab.fileId)).toEqual(['dirty-tab']);
    expect(editor.state.getCurrentFileId()).toBe('dirty-tab');
    expect(editor.state.getSelectedNodeId()).toBe('dirty-node');
    expect(editor.state.getSchema()).toMatchObject({ name: 'dirty-tab' });
  });

  it('tab.activate restores selected node for the target tab', async () => {
    const vfs = createMemoryVFS(createSchema('page-a'));
    const tabManager = new TabManager();
    const editor = createEditor({
      initialSchema: createSchema('empty'),
      tabManager,
      vfs,
      projectId: 'project-1',
    });

    const secondNode = await vfs.createFile(
      'project-1',
      null,
      'page-b',
      'page',
      createSchema('page-b'),
    );

    await editor.commands.execute('tab.open', { fileId: 'demo' });
    editor.state.setSelectedNodeId('node-a');
    await editor.commands.execute('tab.open', { fileId: secondNode.id });
    editor.state.setSelectedNodeId('node-b');

    await editor.commands.execute('tab.activate', { fileId: 'demo' });

    expect(editor.state.getCurrentFileId()).toBe('demo');
    expect(editor.state.getSelectedNodeId()).toBe('node-a');
  });

  it('restores tab manager snapshots in order', () => {
    const manager = new TabManager();
    manager.restoreSnapshot({
      tabs: [
        {
          fileId: 'b',
          filePath: '/b.page.json',
          fileType: 'page',
          fileName: 'B',
          schema: createSchema('B'),
          isDirty: false,
        },
        {
          fileId: 'a',
          filePath: '/a.page.json',
          fileType: 'page',
          fileName: 'A',
          schema: createSchema('A'),
          isDirty: true,
        },
      ],
      activeTabId: 'a',
    });

    expect(manager.getTabs().map((tab) => tab.fileId)).toEqual(['b', 'a']);
    expect(manager.getActiveTabId()).toBe('a');
  });

  it('node.patchProps updates schema and records history', async () => {
    const editor = createEditor({
      initialSchema: createSchemaWithCard('patch-target'),
      fileStorage: createMemoryStorage(),
    });

    await editor.commands.execute('node.patchProps', {
      treeId: 'body.0',
      patch: { title: 'new-title' },
    });

    const schema = editor.state.getSchema();
    const card = Array.isArray(schema.body) ? schema.body[0] : undefined;
    expect(card?.props).toMatchObject({ title: 'new-title' });
    expect(editor.state.getIsDirty()).toBe(true);
    expect(editor.history.getSize()).toBe(1);
  });

  it('node.append appends without recording history', async () => {
    const editor = createEditor({
      initialSchema: createSchemaWithContainer('append-target'),
      fileStorage: createMemoryStorage(),
    });

    await editor.commands.execute('node.append', {
      parentTreeId: 'body',
      node: { id: 'text-1', component: 'Text', children: 'hello' },
    });

    expect(editor.state.getIsDirty()).toBe(true);
    expect(editor.history.getSize()).toBe(0);
    expect(Array.isArray(editor.state.getSchema().body) ? undefined : editor.state.getSchema().body.children).toEqual([
      { id: 'text-1', component: 'Text', children: 'hello' },
    ]);
  });

  it('node.insertAt and node.remove mutate schema without recording history', async () => {
    const editor = createEditor({
      initialSchema: {
        id: 'insert-remove-id',
        name: 'insert-remove',
        body: [
          { id: 'a', component: 'Text' },
          { id: 'b', component: 'Text' },
        ],
      },
      fileStorage: createMemoryStorage(),
    });

    await editor.commands.execute('node.insertAt', {
      index: 1,
      node: { id: 'mid', component: 'Button' },
    });
    await editor.commands.execute('node.remove', { treeId: 'body.0' });

    expect(editor.history.getSize()).toBe(0);
    expect(editor.state.getSchema().body).toEqual([
      { id: 'mid', component: 'Button' },
      { id: 'b', component: 'Text' },
    ]);
  });

  it('schema.restore rolls back streamed changes without pushing history', async () => {
    const initialSchema = createSchemaWithContainer('restore-target');
    const editor = createEditor({
      initialSchema,
      fileStorage: createMemoryStorage(),
    });

    await editor.commands.execute('node.append', {
      parentTreeId: 'body',
      node: { id: 'temp-node', component: 'Text' },
    });
    expect(editor.state.getIsDirty()).toBe(true);
    expect(editor.history.getSize()).toBe(0);

    await editor.commands.execute('schema.restore', { schema: initialSchema });

    expect(editor.state.getSchema()).toBe(initialSchema);
    expect(editor.state.getIsDirty()).toBe(false);
    expect(editor.history.getSize()).toBe(0);
  });

  it('history batch merges multiple operations into one undo point', async () => {
    const editor = createEditor({
      initialSchema: {
        id: 'batch-id',
        name: 'batch-target',
        body: [
          { id: 'a', component: 'Text', props: { text: 'A' } },
          { id: 'b', component: 'Text', props: { text: 'B' } },
        ],
      },
      fileStorage: createMemoryStorage(),
    });

    await editor.commands.execute('history.beginBatch');
    await editor.commands.execute('node.patchProps', {
      treeId: 'body.0',
      patch: { text: 'A1' },
    });
    await editor.commands.execute('node.remove', { treeId: 'body.1' });
    await editor.commands.execute('history.commitBatch');

    expect(editor.history.getSize()).toBe(1);
    expect(editor.state.getSchema().body).toEqual([
      { id: 'a', component: 'Text', props: { text: 'A1' } },
    ]);

    await editor.commands.execute('editor.undo');
    expect(editor.state.getSchema().body).toEqual([
      { id: 'a', component: 'Text', props: { text: 'A' } },
      { id: 'b', component: 'Text', props: { text: 'B' } },
    ]);
  });

  it('editor.restoreSnapshot clears history before restoring the next state', async () => {
    const editor = createEditor({
      initialSchema: createSchemaWithCard('restore-history'),
      fileStorage: createMemoryStorage(),
    });

    await editor.commands.execute('node.patchProps', {
      treeId: 'body.0',
      patch: { title: 'changed-title' },
    });
    expect(editor.history.getSize()).toBe(1);

    await editor.commands.execute('editor.restoreSnapshot', {
      snapshot: {
        schema: createSchema('cleared-page'),
        isDirty: false,
      },
    });

    expect(editor.history.getSize()).toBe(0);
    expect(editor.state.getSnapshot().canUndo).toBe(false);

    await editor.commands.execute('editor.undo');

    expect(editor.state.getSchema()).toMatchObject({ name: 'cleared-page' });
  });

  it('history.discardBatch restores the pre-batch snapshot', async () => {
    const initialSchema = createSchemaWithCard('discard-target');
    const editor = createEditor({
      initialSchema,
      fileStorage: createMemoryStorage(),
    });

    await editor.commands.execute('history.beginBatch');
    await editor.commands.execute('node.patchProps', {
      treeId: 'body.0',
      patch: { title: 'changed' },
    });
    await editor.commands.execute('history.discardBatch');

    expect(editor.state.getSchema()).toEqual(initialSchema);
    expect(editor.history.getSize()).toBe(0);
    expect(editor.state.getIsDirty()).toBe(false);
  });

  it('editor.undo and editor.redo are disabled while history batch is locked', async () => {
    const editor = createEditor({
      initialSchema: createSchemaWithCard('locked-undo'),
      fileStorage: createMemoryStorage(),
    });

    await editor.commands.execute('node.patchProps', {
      treeId: 'body.0',
      patch: { title: 'changed-once' },
    });
    await editor.commands.execute('history.beginBatch');
    await editor.commands.execute('editor.undo');
    await editor.commands.execute('editor.redo');

    expect(editor.state.getSchema().body).toEqual([
      {
        id: 'card-1',
        component: 'Card',
        props: { title: 'changed-once' },
      },
    ]);
    expect(editor.history.isLocked()).toBe(true);
  });

  it('saveAs clears dirty flag after node patch', async () => {
    const editor = createEditor({
      initialSchema: createSchemaWithCard('dirty-saveas'),
      fileStorage: createMemoryStorage(),
    });

    await editor.commands.execute('node.patchProps', {
      treeId: 'body.0',
      patch: { title: 'changed' },
    });
    expect(editor.state.getIsDirty()).toBe(true);

    await editor.commands.execute('file.saveAs', { name: 'dirty-page' });
    expect(editor.state.getCurrentFileId()).toBe('id-dirty-page');
    expect(editor.state.getIsDirty()).toBe(false);
  });
});
