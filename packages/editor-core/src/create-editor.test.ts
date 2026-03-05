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
  });
});
