import { describe, expect, it, vi } from 'vitest';
import type { PageSchema } from '@shenbi/schema';
import { createEditor } from './create-editor';
import type { FileMetadata, FileStorageAdapter } from './adapters/file-storage';

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
    expect(editor.commands.has('file.listSchemas')).toBe(true);
    expect(editor.commands.has('file.openSchema')).toBe(true);
    expect(editor.commands.has('file.saveSchema')).toBe(true);
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
