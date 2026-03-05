import { EditorState } from './editor-state';
import { EventBus } from './event-bus';
import { History } from './history';
import type { Disposable, EditorEventMap, EditorStateSnapshot } from './types';

export interface EditorCommand {
  id: string;
  label: string;
  icon?: string;
  execute(state: EditorState, args?: unknown): unknown | Promise<unknown>;
  canExecute?(state: EditorState): boolean;
  undo?(state: EditorState): void;
  recordHistory?: boolean;
}

function snapshotsEqual(a: EditorStateSnapshot, b: EditorStateSnapshot): boolean {
  return a.schema === b.schema
    && a.selectedNodeId === b.selectedNodeId
    && a.currentFileId === b.currentFileId
    && a.isDirty === b.isDirty
    && a.canUndo === b.canUndo
    && a.canRedo === b.canRedo;
}

export class CommandManager {
  private readonly commands = new Map<string, EditorCommand>();
  private executionDepth = 0;

  constructor(
    private readonly state: EditorState,
    private readonly history: History<EditorStateSnapshot>,
    private readonly eventBus: EventBus<EditorEventMap>,
  ) {
    this.syncHistoryFlags();
  }

  register(command: EditorCommand): Disposable {
    this.commands.set(command.id, command);
    return {
      dispose: () => {
        if (this.commands.get(command.id) === command) {
          this.commands.delete(command.id);
        }
      },
    };
  }

  async execute(commandId: string, args?: unknown): Promise<unknown> {
    const command = this.commands.get(commandId);
    if (!command) {
      throw new Error(`Command not found: ${commandId}`);
    }
    if (command.canExecute && !command.canExecute(this.state)) {
      return;
    }

    const isRootExecution = this.executionDepth === 0;
    const beforeSnapshot = isRootExecution ? this.state.getSnapshot() : undefined;
    this.executionDepth += 1;
    try {
      const result = await command.execute(this.state, args);

      if (isRootExecution) {
        const afterSnapshot = this.state.getSnapshot();
        const shouldRecordHistory = command.recordHistory !== false
          && beforeSnapshot
          && !snapshotsEqual(beforeSnapshot, afterSnapshot);
        if (shouldRecordHistory) {
          this.history.push(afterSnapshot);
          this.eventBus.emit('history:pushed', undefined);
        }
        this.syncHistoryFlags();
      }

      this.eventBus.emit('command:executed', { commandId });
      return result;
    } catch (error) {
      if (isRootExecution) {
        this.syncHistoryFlags();
      }
      throw error;
    } finally {
      this.executionDepth -= 1;
    }
  }

  has(commandId: string): boolean {
    return this.commands.has(commandId);
  }

  getAll(): EditorCommand[] {
    return Array.from(this.commands.values());
  }

  private syncHistoryFlags(): void {
    this.state.setHistoryFlags(this.history.canUndo(), this.history.canRedo());
  }
}
