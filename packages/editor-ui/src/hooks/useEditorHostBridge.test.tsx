import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useEditorHostBridge } from './useEditorHostBridge';

describe('useEditorHostBridge', () => {
  it('shell 模式命令直接走 shell executor', async () => {
    const shellExecute = vi.fn(async () => 'shell-ok');
    const scenarioExecute = vi.fn(async () => 'scenario-ok');
    const { result } = renderHook(() => useEditorHostBridge({
      mode: 'shell',
      shellCommands: { execute: shellExecute },
      scenarioCommands: scenarioExecute,
      activeFileId: 'file:shell',
      schemaName: 'Shell Page',
    }));

    await expect(result.current.executeBaseCommand('editor.undo')).resolves.toBe('shell-ok');
    expect(shellExecute).toHaveBeenCalledWith('editor.undo', undefined);
    expect(scenarioExecute).not.toHaveBeenCalled();
  });

  it('scenarios 模式命令走 scenario executor', async () => {
    const shellExecute = vi.fn(async () => 'shell-ok');
    const scenarioExecute = vi.fn(async () => 'scenario-ok');
    const { result } = renderHook(() => useEditorHostBridge({
      mode: 'scenarios',
      shellCommands: { execute: shellExecute },
      scenarioCommands: scenarioExecute,
      activeFileId: undefined,
      schemaName: 'Scenario Page',
    }));

    await expect(result.current.executeBaseCommand('editor.undo')).resolves.toBe('scenario-ok');
    expect(scenarioExecute).toHaveBeenCalledWith('editor.undo', undefined);
    expect(shellExecute).not.toHaveBeenCalled();
  });

  it('file.saveSchema 在无 fileId 时会转成 file.saveAs', async () => {
    const shellExecute = vi.fn(async () => 'save-ok');
    const promptFileName = vi.fn(() => 'Scenario Demo');
    const { result } = renderHook(() => useEditorHostBridge({
      mode: 'shell',
      shellCommands: { execute: shellExecute },
      scenarioCommands: vi.fn(async () => undefined),
      activeFileId: undefined,
      schemaName: 'Scenario Page',
      promptFileName,
    }));

    await result.current.executePluginCommand('file.saveSchema');

    expect(promptFileName).toHaveBeenCalledWith('Scenario Page');
    expect(shellExecute).toHaveBeenCalledWith('file.saveAs', { name: 'Scenario Demo' });
  });

  it('shell 模式下 file.saveSchema 在有活动标签时会走 tab.save', async () => {
    const shellExecute = vi.fn(async () => 'save-ok');
    const { result } = renderHook(() => useEditorHostBridge({
      mode: 'shell',
      shellCommands: { execute: shellExecute },
      scenarioCommands: vi.fn(async () => undefined),
      activeFileId: 'api-1',
      schemaName: 'Billing API',
    }));

    await result.current.executePluginCommand('file.saveSchema');

    expect(shellExecute).toHaveBeenCalledWith('tab.save', undefined);
  });

  it('file.saveAs 会优先使用显式名称，否则再询问宿主', async () => {
    const shellExecute = vi.fn(async () => 'save-ok');
    const promptFileName = vi.fn(() => 'Prompt Name');
    const { result } = renderHook(() => useEditorHostBridge({
      mode: 'shell',
      shellCommands: { execute: shellExecute },
      scenarioCommands: vi.fn(async () => undefined),
      activeFileId: undefined,
      schemaName: 'Shell Page',
      promptFileName,
    }));

    await result.current.executePluginCommand('file.saveAs', { name: 'Explicit Name' });
    expect(promptFileName).not.toHaveBeenCalled();
    expect(shellExecute).toHaveBeenLastCalledWith('file.saveAs', { name: 'Explicit Name' });

    await result.current.executePluginCommand('file.saveAs');
    expect(promptFileName).toHaveBeenCalledWith('Shell Page');
    expect(shellExecute).toHaveBeenLastCalledWith('file.saveAs', { name: 'Prompt Name' });
  });
});
