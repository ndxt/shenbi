import type { ComponentContract, PageSchema, SchemaNode } from '@shenbi/schema';
import {
  executePluginCommand,
  getPluginSchema,
  getPluginSelectedNodeId,
  replacePluginSchema,
  type PluginContext,
} from '@shenbi/editor-plugin-api';

export interface EditorBridgeSnapshot {
  schema: PageSchema;
  selectedNodeId?: string;
}

export interface ExecuteResult {
  success: boolean;
  error?: string;
  data?: unknown;
}

export interface EditorAIBridge {
  getSchema(): PageSchema;
  getSelectedNodeId(): string | undefined;
  getAvailableComponents(): ComponentContract[];
  execute(commandId: string, args?: unknown): Promise<ExecuteResult>;
  replaceSchema(schema: PageSchema): void;
  appendBlock(node: SchemaNode, parentTreeId?: string): Promise<ExecuteResult>;
  removeNode(treeId: string): Promise<ExecuteResult>;
  subscribe(listener: (snapshot: EditorBridgeSnapshot) => void): () => void;
}

interface EditorAIBridgeOptions {
  getSnapshot: () => EditorBridgeSnapshot;
  replaceSchema: (schema: PageSchema) => void;
  getAvailableComponents: () => ComponentContract[];
  execute: (commandId: string, args?: unknown) => Promise<ExecuteResult>;
  subscribe: (listener: (snapshot: EditorBridgeSnapshot) => void) => () => void;
}

export interface EditorAIBridgeFromPluginContextOptions {
  context: PluginContext;
  getAvailableComponents: () => ComponentContract[];
  subscribe?: (listener: (snapshot: EditorBridgeSnapshot) => void) => () => void;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function getCommandArgRecord(args: unknown): Record<string, unknown> | undefined {
  return isRecord(args) ? args : undefined;
}

function isSchemaNode(value: unknown): boolean {
  return isRecord(value) && typeof value.component === 'string';
}

function validatePageSchema(schema: unknown): asserts schema is PageSchema {
  if (!isRecord(schema)) {
    throw new Error('schema must be an object');
  }
  if (!('body' in schema)) {
    throw new Error('schema.body is required');
  }
  const body = schema.body;
  const validBody = Array.isArray(body)
    ? body.every((item) => isSchemaNode(item))
    : isSchemaNode(body);
  if (!validBody) {
    throw new Error('schema.body must be a schema node or schema node array');
  }
}

export function createEditorAIBridge(options: EditorAIBridgeOptions): EditorAIBridge {
  return {
    getSchema() {
      return options.getSnapshot().schema;
    },
    getSelectedNodeId() {
      return options.getSnapshot().selectedNodeId;
    },
    getAvailableComponents() {
      return options.getAvailableComponents();
    },
    async execute(commandId, args) {
      return options.execute(commandId, args);
    },
    replaceSchema(schema) {
      validatePageSchema(schema);
      void options.execute('schema.replace', { schema });
    },
    async appendBlock(node, parentTreeId) {
      return options.execute('node.append', { node, parentTreeId });
    },
    async removeNode(treeId) {
      return options.execute('node.remove', { treeId });
    },
    subscribe(listener) {
      return options.subscribe(listener);
    },
  };
}

export function createEditorAIBridgeFromPluginContext(
  options: EditorAIBridgeFromPluginContextOptions,
): EditorAIBridge {
  // Local cache: the editor host may not reflect replaced schema immediately.
  // When the host still reports an empty body, return the cached version instead.
  let lastReplacedSchema: PageSchema | undefined;

  function hasBody(schema: PageSchema | undefined): boolean {
    if (!schema) return false;
    const body = schema.body;
    return Array.isArray(body) ? body.length > 0 : Boolean(body);
  }

  const getSnapshot = (): EditorBridgeSnapshot => {
    const hostSchema = getPluginSchema(options.context);
    const selectedNodeId = getPluginSelectedNodeId(options.context);

    // Prefer host schema when it has content; fall back to cache when host is empty.
    let schema: PageSchema;
    if (hostSchema && hasBody(hostSchema)) {
      schema = hostSchema;
    } else if (lastReplacedSchema && hasBody(lastReplacedSchema)) {
      schema = lastReplacedSchema;
    } else {
      schema = hostSchema ?? { id: 'plugin-empty-page', body: [] };
    }

    return {
      schema,
      ...(selectedNodeId ? { selectedNodeId } : {}),
    };
  };

  const subscribe = options.subscribe ?? ((listener: (snapshot: EditorBridgeSnapshot) => void) => {
    const unsubs: Array<() => void> = [];
    const notify = () => listener(getSnapshot());

    const unsubDocument = options.context.document?.subscribe?.(() => {
      notify();
    });
    if (unsubDocument) {
      unsubs.push(unsubDocument);
    }

    const unsubSelection = options.context.selection?.subscribe?.(() => {
      notify();
    });
    if (unsubSelection) {
      unsubs.push(unsubSelection);
    }

    notify();
    return () => {
      for (const unsub of unsubs) {
        unsub();
      }
    };
  });

  return createEditorAIBridge({
    getSnapshot,
    replaceSchema: (schema) => {
      lastReplacedSchema = schema;
      if (replacePluginSchema(options.context, schema)) {
        return;
      }
    },
    execute: async (commandId, args) => {
      try {
        const filesystem = options.context.filesystem;
        const commandArgs = getCommandArgRecord(args);

        if (filesystem && commandId === 'fs.createFile') {
          const name = typeof commandArgs?.name === 'string' ? commandArgs.name : '';
          const fileType = typeof commandArgs?.fileType === 'string' ? commandArgs.fileType : 'page';
          const parentId = typeof commandArgs?.parentId === 'string' ? commandArgs.parentId : undefined;
          const content = isRecord(commandArgs?.content) ? commandArgs.content : { id: 'page', name, body: [] };
          const fileId = await filesystem.createFile(name, fileType, content, parentId);
          return { success: true, data: { id: fileId } };
        }

        if (filesystem && commandId === 'fs.createFolder') {
          const name = typeof commandArgs?.name === 'string' ? commandArgs.name : '';
          const parentId = typeof commandArgs?.parentId === 'string' ? commandArgs.parentId : undefined;
          const folderId = await filesystem.createFile(name, 'folder', {}, parentId);
          return { success: true, data: { id: folderId } };
        }

        if (filesystem && commandId === 'file.readSchema') {
          const fileId = typeof commandArgs?.fileId === 'string' ? commandArgs.fileId : '';
          const schema = await filesystem.readFile(fileId);
          return { success: true, data: schema };
        }

        if (filesystem && commandId === 'file.writeSchema') {
          const fileId = typeof commandArgs?.fileId === 'string' ? commandArgs.fileId : '';
          const schema = isRecord(commandArgs?.schema) ? commandArgs.schema : undefined;
          if (!fileId || !schema) {
            throw new Error('file.writeSchema expects args: { fileId: string, schema: PageSchema }');
          }
          await filesystem.writeFile(fileId, schema);
          return { success: true };
        }

        // Track schema replacements through the command path as well.
        if (commandId === 'schema.replace' && args && typeof args === 'object' && 'schema' in args) {
          lastReplacedSchema = (args as { schema: PageSchema }).schema;
        }
        // Clear cache on document reset.
        if (commandId === 'workspace.resetDocument') {
          lastReplacedSchema = undefined;
        }

        const hasCommandHandler = Boolean(options.context.commands?.execute || options.context.executeCommand);
        if (hasCommandHandler) {
          const data = await executePluginCommand(options.context, commandId, args);
          return { success: true, data };
        }
        if (commandId === 'schema.replace' && args && typeof args === 'object' && 'schema' in args) {
          if (replacePluginSchema(options.context, (args as { schema: PageSchema }).schema)) {
            return { success: true };
          }
        }
        return { success: true };
      } catch (error) {
        const msg = error instanceof Error
          ? error.message
          : (error != null ? String(error) : `${commandId} failed (unknown error)`);
        return { success: false, error: msg };
      }
    },
    getAvailableComponents: options.getAvailableComponents,
    subscribe,
  });
}
