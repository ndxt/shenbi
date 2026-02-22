/**
 * 不可变路径设置：返回新对象，不修改原对象。
 * 支持 'a.b.c' 路径写入。
 */
function isRecord(value: unknown): value is Record<string, any> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function setByPathImmutable(
  target: Record<string, any>,
  path: string,
  value: any,
): Record<string, any> {
  const keys = path.split('.').filter(Boolean);
  if (keys.length === 0) {
    return target;
  }

  if (keys.length === 1) {
    return { ...target, [keys[0]!]: value };
  }

  const [head, ...rest] = keys;
  const nextValue = target[head!] as unknown;
  const nestedTarget = isRecord(nextValue) ? nextValue : {};

  return {
    ...target,
    [head!]: setByPathImmutable(nestedTarget, rest.join('.'), value),
  };
}

/**
 * 可变路径设置：直接修改 target 对象。
 * 支持 'a.b.c' 路径写入，中间路径不存在时自动创建空对象。
 */
export function setByPathMutable(
  target: Record<string, any>,
  path: string,
  value: any,
): void {
  const keys = path.split('.').filter(Boolean);
  if (keys.length === 0) {
    return;
  }

  let cursor: Record<string, any> = target;
  for (let i = 0; i < keys.length - 1; i += 1) {
    const key = keys[i]!;
    if (!isRecord(cursor[key])) {
      cursor[key] = {};
    }
    cursor = cursor[key];
  }
  cursor[keys[keys.length - 1]!] = value;
}
