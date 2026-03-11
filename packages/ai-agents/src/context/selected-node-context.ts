export function buildSelectedNodeHint(selectedNodeId: string | undefined): string | undefined {
  if (!selectedNodeId) {
    return undefined;
  }
  // selectedNodeId may be a path expression like "body.0.children.1..." used by the editor
  // internally, NOT a schema node id. The actual node id to use in operations must come from
  // the Schema Tree (the "#id" part, e.g. Card#block-1-kpi-overview → id = "block-1-kpi-overview").
  const isPath = /^body(\.\d+|\.(children|dialogs))*/.test(selectedNodeId);
  if (isPath) {
    return [
      `User is currently focused on the node at path "${selectedNodeId}".`,
      `IMPORTANT: This is an editor path, NOT a node id. Look up the node at this path in the Schema Tree above and use its schema id (the part after "#", e.g. "block-1-kpi-overview") as the nodeId in operations.`,
      `Do NOT use the path string "${selectedNodeId}" as a nodeId directly.`,
    ].join('\n');
  }
  return `User is currently focused on node "${selectedNodeId}". Use this id directly in nodeId / parentId fields.`;
}
