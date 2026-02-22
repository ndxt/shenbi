import { describe, expect, it, vi } from 'vitest';
import type { SyncToUrlDef } from '@shenbi/schema';
import { readUrlSyncedState, writeUrlSyncedState } from './sync-url';

describe('runtime/sync-url', () => {
  it('readUrlSyncedState 支持 number/boolean/json 转换', () => {
    const defs: SyncToUrlDef[] = [
      { stateKey: 'pagination.current', queryKey: 'page', transform: 'number' },
      { stateKey: 'enabled', transform: 'boolean' },
      { stateKey: 'filters', transform: 'json' },
    ];

    const restored = readUrlSyncedState(
      defs,
      '?page=3&enabled=true&filters=%7B%22status%22%3A%22active%22%7D',
    );

    expect(restored).toEqual({
      pagination: { current: 3 },
      enabled: true,
      filters: { status: 'active' },
    });
  });

  it('readUrlSyncedState 会忽略非法 number/boolean/json', () => {
    const defs: SyncToUrlDef[] = [
      { stateKey: 'page', transform: 'number' },
      { stateKey: 'enabled', transform: 'boolean' },
      { stateKey: 'filters', transform: 'json' },
    ];

    const restored = readUrlSyncedState(defs, '?page=abc&enabled=not-bool&filters=%7Bbad-json');
    expect(restored).toEqual({});
  });

  it('writeUrlSyncedState 会更新映射字段并保留无关 query', () => {
    const defs: SyncToUrlDef[] = [
      { stateKey: 'pagination.current', queryKey: 'page', transform: 'number' },
      { stateKey: 'enabled', transform: 'boolean' },
      { stateKey: 'filters', transform: 'json' },
    ];

    const replaceState = vi.fn();
    writeUrlSyncedState(
      defs,
      {
        pagination: { current: 5 },
        enabled: false,
        filters: { status: 'paused' },
      },
      { pathname: '/users', search: '?keep=1', hash: '#top' },
      { replaceState, state: null },
    );

    expect(replaceState).toHaveBeenCalledTimes(1);
    const nextUrl = replaceState.mock.calls[0]?.[2] as string;
    expect(nextUrl).toContain('/users?');
    expect(nextUrl).toContain('keep=1');
    expect(nextUrl).toContain('page=5');
    expect(nextUrl).toContain('enabled=false');
    expect(nextUrl).toContain('filters=');
    expect(nextUrl).toContain('#top');
  });

  it('writeUrlSyncedState 在值为空时会删除 query', () => {
    const defs: SyncToUrlDef[] = [
      { stateKey: 'keyword', transform: 'string' },
    ];
    const replaceState = vi.fn();

    writeUrlSyncedState(
      defs,
      { keyword: '' },
      { pathname: '/users', search: '?keyword=abc&keep=1', hash: '' },
      { replaceState, state: null },
    );

    expect(replaceState).toHaveBeenCalledTimes(1);
    const nextUrl = replaceState.mock.calls[0]?.[2] as string;
    expect(nextUrl).toBe('/users?keep=1');
  });
});
