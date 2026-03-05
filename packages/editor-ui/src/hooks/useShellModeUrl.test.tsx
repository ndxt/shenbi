import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getInitialShellMode, syncShellModeToUrl, useShellModeUrl } from './useShellModeUrl';

describe('useShellModeUrl', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/');
    delete (window as unknown as Record<string, unknown>).__SHENBI_SHELL_MODE__;
  });

  it('优先从 URL query 读取 shell 模式', () => {
    window.history.replaceState(null, '', '/?mode=shell');
    expect(getInitialShellMode()).toBe('shell');
  });

  it('URL 未命中时可回退到全局 flag', () => {
    (window as unknown as Record<string, unknown>).__SHENBI_SHELL_MODE__ = true;
    expect(getInitialShellMode()).toBe('shell');
  });

  it('非浏览器环境默认 scenarios', () => {
    vi.stubGlobal('window', undefined);
    expect(getInitialShellMode()).toBe('scenarios');
    vi.unstubAllGlobals();
  });

  it('syncShellModeToUrl 可写入并删除 mode 查询参数', () => {
    window.history.replaceState(null, '', '/?page=1');
    syncShellModeToUrl('shell');
    expect(window.location.search).toContain('page=1');
    expect(window.location.search).toContain('mode=shell');

    syncShellModeToUrl('scenarios');
    expect(window.location.search).toContain('page=1');
    expect(window.location.search).not.toContain('mode=shell');
  });

  it('hook 切换模式时会同步 URL', () => {
    window.history.replaceState(null, '', '/');
    const { result } = renderHook(() => useShellModeUrl());

    expect(result.current[0]).toBe('scenarios');

    act(() => {
      result.current[1]('shell');
    });
    expect(window.location.search).toContain('mode=shell');

    act(() => {
      result.current[1]('scenarios');
    });
    expect(window.location.search).toBe('');
  });
});
