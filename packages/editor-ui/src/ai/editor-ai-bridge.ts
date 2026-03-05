import type { ComponentContract, PageSchema } from '@shenbi/schema';

export interface EditorBridgeSnapshot {
  schema: PageSchema;
  selectedNodeId?: string;
}

export interface ExecuteResult {
  success: boolean;
  error?: string;
}

export interface EditorAIBridge {
  getSchema(): PageSchema;
  getSelectedNodeId(): string | undefined;
  getAvailableComponents(): ComponentContract[];
  execute(commandId: string, args?: unknown): Promise<ExecuteResult>;
  replaceSchema(schema: PageSchema): void;
  subscribe(listener: (snapshot: EditorBridgeSnapshot) => void): () => void;
}

interface EditorAIBridgeOptions {
  getSnapshot: () => EditorBridgeSnapshot;
  replaceSchema: (schema: PageSchema) => void;
  getAvailableComponents: () => ComponentContract[];
  subscribe: (listener: (snapshot: EditorBridgeSnapshot) => void) => () => void;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
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

function extractSchemaFromArgs(args: unknown): PageSchema {
  if (!isRecord(args) || !('schema' in args)) {
    throw new Error('schema.replace expects args: { schema }');
  }
  validatePageSchema(args.schema);
  return args.schema;
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
      try {
        if (commandId === 'schema.replace') {
          const schema = extractSchemaFromArgs(args);
          options.replaceSchema(schema);
          return { success: true };
        }
        return { success: false, error: `Unsupported command: ${commandId}` };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { success: false, error: message };
      }
    },
    replaceSchema(schema) {
      validatePageSchema(schema);
      options.replaceSchema(schema);
    },
    subscribe(listener) {
      return options.subscribe(listener);
    },
  };
}
