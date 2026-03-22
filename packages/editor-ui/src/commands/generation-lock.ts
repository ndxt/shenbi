export function isCommandBlockedDuringGeneration(commandId: string): boolean {
  if (
    commandId === 'workspace.resetDocument'
    || commandId === 'schema.replace'
    || commandId === 'schema.restore'
    || commandId === 'file.openSchema'
    || commandId === 'file.saveSchema'
    || commandId === 'file.saveAs'
    || commandId === 'file.deleteSchema'
    || commandId === 'editor.undo'
    || commandId === 'editor.redo'
  ) {
    return true;
  }
  return commandId.startsWith('node.') || commandId.startsWith('history.');
}
