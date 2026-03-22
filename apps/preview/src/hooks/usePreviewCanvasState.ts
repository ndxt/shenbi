import * as antd from 'antd';
import {
  useCanvasEditingCommands,
  type UseCanvasEditingCommandsOptions,
} from '@shenbi/editor-ui';
import type { PreviewCanvasState } from '../preview-types';

type UsePreviewCanvasStateOptions = Omit<UseCanvasEditingCommandsOptions, 'shellCommands' | 'notifyCommandLocked' | 'onError'> & {
  fileEditor: {
    commands: {
      execute: (commandId: string, payload?: unknown) => Promise<unknown>;
    };
  };
  notifyGenerationLock: () => boolean;
};

export function usePreviewCanvasState({
  fileEditor,
  notifyGenerationLock,
  ...options
}: UsePreviewCanvasStateOptions): PreviewCanvasState {
  return useCanvasEditingCommands({
    ...options,
    shellCommands: fileEditor.commands,
    notifyCommandLocked: notifyGenerationLock,
    onError: (message) => {
      antd.message.error(message);
    },
  });
}
