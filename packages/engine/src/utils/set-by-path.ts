/**
 * 不可变路径设置：返回新对象，不修改原对象。
 * 支持 'a.b.c' 路径写入。
 */
export function setByPathImmutable(
  target: Record<string, any>,
  path: string,
  value: any,
): Record<string, any> {
  const keys = path.split('.');
  const result = { ...target };
  if (keys.length === 1) {
    result[keys[0]!] = value;
    return result;
  }
  let cursor: Record<string, any> = result;
  for (let i = 0; i < keys.length - 1; i += 1) {
    const key = keys[i]!;
    cursor[key] = { ...cursor[key] };
    cursor = cursor[key];
  }
  cursor[keys[keys.length - 1]!] = value;
  return result;
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
  const keys = path.split('.');
  let cursor: Record<string, any> = target;
  for (let i = 0; i < keys.length - 1; i += 1) {
    const key = keys[i]!;
    if (!cursor[key] || typeof cursor[key] !== 'object') {
      cursor[key] = {};
    }
    cursor = cursor[key];
  }
  cursor[keys[keys.length - 1]!] = value;
}
