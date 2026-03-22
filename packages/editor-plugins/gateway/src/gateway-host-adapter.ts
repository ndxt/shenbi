import type { CanvasRendererRenderContext } from '@shenbi/editor-plugin-api';
import { getPluginNotifications } from '@shenbi/editor-plugin-api';
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
  const filesystem = context.pluginContext?.filesystem;
  const fileId = context.activeFileId;
  if (!filesystem || !fileId) {
    return undefined;
  }

  const notifications = context.pluginContext
    ? getPluginNotifications(context.pluginContext)
    : undefined;
  const fileName = context.activeFileName
    ? stripGatewayFileExtension(context.activeFileName)
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
