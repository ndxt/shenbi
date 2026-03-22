import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useHostCommandPolicy } from './useHostCommandPolicy';

describe('useHostCommandPolicy', () => {
  it('优先执行拦截器', async () => {
    const executeBaseCommand = vi.fn(async () => 'base');
    const interceptor = vi.fn(async () => 'blocked');

    const { result } = renderHook(() => useHostCommandPolicy({
      executeBaseCommand,
      interceptors: [
        {
          matches: (commandId) => commandId === 'node.insertAt',
          handle: interceptor,
        },
      ],
    }));

    await expect(result.current.executeCommand('node.insertAt')).resolves.toBe('blocked');
    expect(interceptor).toHaveBeenCalledWith('node.insertAt', undefined);
    expect(executeBaseCommand).not.toHaveBeenCalled();
  });

  it('命令处理器会覆盖默认执行器', async () => {
    const executeBaseCommand = vi.fn(async () => 'base');
    const resetWorkspace = vi.fn(async () => 'reset');

    const { result } = renderHook(() => useHostCommandPolicy({
      executeBaseCommand,
      commandHandlers: {
        'workspace.resetDocument': resetWorkspace,
      },
    }));

    await expect(result.current.executeCommand('workspace.resetDocument')).resolves.toBe('reset');
    expect(resetWorkspace).toHaveBeenCalled();
    expect(executeBaseCommand).not.toHaveBeenCalled();
  });
});
