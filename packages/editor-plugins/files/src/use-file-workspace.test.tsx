import { act, fireEvent, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useFileWorkspace, type FileCommandExecutor } from './use-file-workspace';

interface MockCommandsContext {
  listResult?: unknown;
  saveAsResult?: unknown;
}

function createCommands(context: MockCommandsContext = {}): FileCommandExecutor & { execute: ReturnType<typeof vi.fn> } {
  const execute = vi.fn(async (commandId: string, args?: unknown) => {
    if (commandId === 'file.listSchemas') {
      return context.listResult ?? [];
    }
    if (commandId === 'file.saveAs') {
      return context.saveAsResult ?? (args as { name?: string } | undefined)?.name ?? 'saved-file';
    }
    if (commandId === 'file.saveSchema') {
      return undefined;
    }
    if (commandId === 'tab.save') {
      return undefined;
    }
    if (commandId === 'editor.undo' || commandId === 'editor.redo' || commandId === 'file.openSchema') {
      return undefined;
    }
    throw new Error(`Unexpected command: ${commandId}`);
  });
  return { execute };
}

describe('useFileWorkspace', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shell 模式会加载文件并生成 Files tab', async () => {
    const commands = createCommands({
      listResult: [
        { id: 'file-1', name: 'A Page', updatedAt: 1 },
        { id: 'file-2', name: 'B Page', updatedAt: 2 },
      ],
    });
    const { result } = renderHook(() => useFileWorkspace({
      mode: 'shell',
      snapshot: {
        currentFileId: 'file-2',
        schemaName: 'Shell Page',
        isDirty: false,
        canUndo: false,
        canRedo: false,
      },
      commands,
    }));

    await waitFor(() => {
      expect(result.current.activeFileName).toBe('B Page');
    });
    expect(result.current.filesSidebarTab?.id).toBe('files');
    expect(result.current.filesPrimaryPanel?.id).toBe('files');
    expect(commands.execute).toHaveBeenCalledWith('file.listSchemas');
  });

  it('legacy 模式下无 activeFileId 时保存会走另存为', async () => {
    const commands = createCommands({ saveAsResult: 'new-file-id' });
    const { result } = renderHook(() => useFileWorkspace({
      mode: 'scenarios',
      snapshot: {
        currentFileId: undefined,
        schemaName: 'Draft',
        isDirty: true,
        canUndo: false,
        canRedo: false,
      },
      commands,
      promptFileName: () => 'My Draft',
    }));

    act(() => {
      result.current.handleSave();
    });

    await waitFor(() => {
      expect(commands.execute).toHaveBeenCalledWith('file.saveAs', { name: 'My Draft' });
    });
    await waitFor(() => {
      expect(result.current.fileStatus).toContain('Saved');
    });
  });

  it('Ctrl+S 会触发保存', async () => {
    const commands = createCommands();
    renderHook(() => useFileWorkspace({
      mode: 'shell',
      snapshot: {
        currentFileId: 'file-1',
        schemaName: 'Demo',
        isDirty: true,
        canUndo: true,
        canRedo: true,
      },
      commands,
    }));

    fireEvent.keyDown(window, { key: 's', ctrlKey: true });

    await waitFor(() => {
      expect(commands.execute).toHaveBeenCalledWith('tab.save');
    });
  });

  it('shell 模式无活动文件时保存会给出提示且不触发 saveAs', async () => {
    const onError = vi.fn();
    const commands = createCommands();
    const { result } = renderHook(() => useFileWorkspace({
      mode: 'shell',
      snapshot: {
        currentFileId: undefined,
        schemaName: 'Draft',
        isDirty: true,
        canUndo: false,
        canRedo: false,
      },
      commands,
      onError,
      promptFileName: () => 'ignored',
    }));

    act(() => {
      result.current.handleSave();
    });

    await waitFor(() => {
      expect(result.current.fileStatus).toBe('Create or open a file from the file tree first');
      expect(onError).toHaveBeenCalledWith('Create or open a file from the file tree first');
    });
    expect(commands.execute).not.toHaveBeenCalledWith('file.saveAs', expect.anything());
  });

  it('Ctrl+Z / Ctrl+Shift+Z 会触发撤销与重做', async () => {
    const commands = createCommands();
    renderHook(() => useFileWorkspace({
      mode: 'shell',
      snapshot: {
        currentFileId: 'file-1',
        schemaName: 'Demo',
        isDirty: true,
        canUndo: true,
        canRedo: true,
      },
      commands,
    }));

    fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true, shiftKey: true });

    await waitFor(() => {
      expect(commands.execute).toHaveBeenCalledWith('editor.undo');
      expect(commands.execute).toHaveBeenCalledWith('editor.redo');
    });
  });

  it('输入框聚焦时不劫持 Ctrl+Z', async () => {
    const commands = createCommands();
    renderHook(() => useFileWorkspace({
      mode: 'shell',
      snapshot: {
        currentFileId: 'file-1',
        schemaName: 'Demo',
        isDirty: true,
        canUndo: true,
        canRedo: true,
      },
      commands,
    }));

    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();

    fireEvent.keyDown(input, { key: 'z', ctrlKey: true });

    await waitFor(() => {
      expect(commands.execute).not.toHaveBeenCalledWith('editor.undo');
    });

    document.body.removeChild(input);
  });

  it('脏状态下 beforeunload 会被拦截', async () => {
    const commands = createCommands();
    renderHook(() => useFileWorkspace({
      mode: 'shell',
      snapshot: {
        currentFileId: 'file-1',
        schemaName: 'Demo',
        isDirty: true,
        canUndo: false,
        canRedo: false,
      },
      commands,
    }));

    await waitFor(() => {
      expect(commands.execute).toHaveBeenCalledWith('file.listSchemas');
    });

    const beforeUnloadEvent = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(beforeUnloadEvent);
    expect(beforeUnloadEvent.defaultPrevented).toBe(true);
  });

  it('从脏变干净后 beforeunload 不再拦截', async () => {
    const commands = createCommands();
    const { rerender } = renderHook((props: { isDirty: boolean }) => useFileWorkspace({
      mode: 'shell',
      snapshot: {
        currentFileId: 'file-1',
        schemaName: 'Demo',
        isDirty: props.isDirty,
        canUndo: false,
        canRedo: false,
      },
      commands,
    }), {
      initialProps: { isDirty: true },
    });

    await waitFor(() => {
      expect(commands.execute).toHaveBeenCalledWith('file.listSchemas');
    });

    const dirtyEvent = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(dirtyEvent);
    expect(dirtyEvent.defaultPrevented).toBe(true);

    act(() => {
      rerender({ isDirty: false });
    });

    const cleanEvent = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(cleanEvent);
    expect(cleanEvent.defaultPrevented).toBe(false);
  });
});
