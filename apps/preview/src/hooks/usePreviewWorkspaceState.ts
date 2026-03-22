import * as antd from 'antd';
import {
  useWorkspaceHost,
  type UseWorkspaceHostOptions,
} from '@shenbi/editor-ui';
import type { PreviewWorkspaceState } from '../preview-types';
import { createEmptyShellSchema } from '../editor/previewSchemaUtils';

type UsePreviewWorkspaceStateOptions = Omit<
  UseWorkspaceHostOptions,
  'createEmptySchema' | 'messages' | 'dialogs' | 'notifications'
> & {
  previewT: (...args: any[]) => string;
  filesT: (...args: any[]) => string;
};

export function usePreviewWorkspaceState({
  previewT,
  filesT,
  ...options
}: UsePreviewWorkspaceStateOptions): PreviewWorkspaceState {
  return useWorkspaceHost({
    ...options,
    createEmptySchema: createEmptyShellSchema,
    messages: {
      promptEnterFileName: previewT('prompt.enterFileName'),
      promptConfirmClose: previewT('prompt.confirmClose'),
      toolbarUntitled: previewT('toolbar.untitled'),
      importInvalidJSON: previewT('import.invalidJSON'),
      importMissingBody: previewT('import.missingBody'),
      importSuccess: previewT('import.success'),
      importReadError: previewT('import.readError'),
      generationLockReasonFallback: 'AI 正在生成此页面，当前页为只读预览。',
      statusNoActiveFile: filesT('status.noActiveFile'),
      statusUnsavedShort: filesT('status.unsavedShort'),
      statusAutoSaved: filesT('status.autoSaved'),
      statusSavedShort: filesT('status.savedShort'),
    },
    dialogs: {
      promptFileName: (defaultName) => {
        if (typeof window === 'undefined') {
          return null;
        }
        return window.prompt(previewT('prompt.enterFileName'), defaultName);
      },
      confirmClose: (message) => {
        if (typeof window === 'undefined') {
          return true;
        }
        return window.confirm(message);
      },
    },
    notifications: {
      warning: (message) => antd.message.warning(message),
      error: (message) => antd.message.error(message),
      success: (message) => antd.message.success(message),
    },
  });
}
