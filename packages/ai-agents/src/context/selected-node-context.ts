export function buildSelectedNodeHint(selectedNodeId: string | undefined): string | undefined {
  if (!selectedNodeId) {
    return undefined;
  }
  return `User is currently focused on node "${selectedNodeId}".`;
}
