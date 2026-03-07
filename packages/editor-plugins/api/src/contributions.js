export function mergeContributions(builtin, extensions) {
    const merged = new Map();
    for (const item of builtin) {
        merged.set(item.id, item);
    }
    for (const item of extensions ?? []) {
        merged.set(item.id, item);
    }
    return [...merged.values()].sort((left, right) => (left.order ?? 0) - (right.order ?? 0));
}
