import { describe, expect, it } from 'vitest';
import {
  createEditorAIBridge as hostCreateEditorAIBridge,
  useEditorAIBridge as hostUseEditorAIBridge,
} from './index';
import {
  createEditorAIBridge as pluginCreateEditorAIBridge,
  useEditorAIBridge as pluginUseEditorAIBridge,
} from '@shenbi/editor-plugin-ai-chat';
import {
  ActionPanel as hostActionPanel,
  createFilesSidebarTab as hostCreateFilesSidebarTab,
  FilePanel as hostFilePanel,
  SetterPanel as hostSetterPanel,
  useFileWorkspace as hostUseFileWorkspace,
} from './index';
import {
  createFilesSidebarTab as pluginCreateFilesSidebarTab,
  FilePanel as pluginFilePanel,
  useFileWorkspace as pluginUseFileWorkspace,
} from '@shenbi/editor-plugin-files';
import {
  ActionPanel as pluginActionPanel,
  SetterPanel as pluginSetterPanel,
} from '@shenbi/editor-plugin-setter';

describe('editor-ui plugin compatibility re-exports', () => {
  it('re-exports Files plugin APIs', () => {
    expect(hostFilePanel).toBe(pluginFilePanel);
    expect(hostUseFileWorkspace).toBe(pluginUseFileWorkspace);
    expect(hostCreateFilesSidebarTab).toBe(pluginCreateFilesSidebarTab);
  });

  it('re-exports AI plugin APIs', () => {
    expect(hostCreateEditorAIBridge).toBe(pluginCreateEditorAIBridge);
    expect(hostUseEditorAIBridge).toBe(pluginUseEditorAIBridge);
  });

  it('re-exports Setter plugin APIs', () => {
    expect(hostActionPanel).toBe(pluginActionPanel);
    expect(hostSetterPanel).toBe(pluginSetterPanel);
  });
});
