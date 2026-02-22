import { describe, expect, it } from 'vitest';
import { setByPathImmutable, setByPathMutable } from './set-by-path';

describe('utils/set-by-path', () => {
  it('setByPathImmutable 会在中间路径非对象时安全覆盖为对象分支', () => {
    const prev = { form: 'legacy', keep: true };
    const next = setByPathImmutable(prev, 'form.user.name', 'alice');

    expect(next).toEqual({
      form: {
        user: {
          name: 'alice',
        },
      },
      keep: true,
    });
    expect(next).not.toBe(prev);
  });

  it('setByPathImmutable 对空路径返回原对象', () => {
    const prev = { a: 1 };
    const next = setByPathImmutable(prev, '', 2);

    expect(next).toBe(prev);
    expect(next).toEqual({ a: 1 });
  });

  it('setByPathMutable 会创建缺失路径并写入值', () => {
    const target: Record<string, any> = {};
    setByPathMutable(target, 'a.b.c', 1);
    expect(target).toEqual({ a: { b: { c: 1 } } });
  });

  it('setByPathMutable 对空路径不做修改', () => {
    const target = { a: 1 };
    setByPathMutable(target, '', 2);
    expect(target).toEqual({ a: 1 });
  });
});
