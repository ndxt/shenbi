import type { CanvasRendererRenderContext } from '@shenbi/editor-plugin-api';
import { getPluginFeedbackAccess } from '@shenbi/editor-plugin-api';
import type { GatewayDocumentSchema } from './types';

export interface GatewayHostAdapter {
  fileId: string;
  fileName: string;
  loadDocument: () => Promise<Record<string, unknown> | undefined>;
  saveDocument: (document: GatewayDocumentSchema) => Promise<void>;
  notifyError: (message: string) => void;
}

function stripGatewayFileExtension(fileName: string): string {
  return fileName.replace(/\.api(\.json)?$/i, '').trim() || fileName;
}

export function createGatewayHostAdapter(
  context: CanvasRendererRenderContext,
): GatewayHostAdapter | undefined {
  const filesystem = context.environment.pluginContext?.filesystem;
  const fileId = context.file.id;
  if (!filesystem || !fileId) {
    return undefined;
  }

  const notifications = context.environment.pluginContext
    ? getPluginFeedbackAccess(context.environment.pluginContext).notifications
    : undefined;
  const fileName = context.file.name
    ? stripGatewayFileExtension(context.file.name)
    : 'API Workflow';

  return {
    fileId,
    fileName,
    loadDocument: async () => {
      return await filesystem.readFile(fileId);
    },
    saveDocument: async (document) => {
      await filesystem.writeFile(fileId, document as unknown as Record<string, unknown>);
    },
    notifyError: (message: string) => {
      notifications?.error?.(message);
    },
  };
}
