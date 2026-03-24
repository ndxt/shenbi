export interface HistorySnapshot<T> {
  current: T;
  undoStack: T[];
  redoStack: T[];
}

export interface HistoryOptions {
  maxSize?: number;
}

export class History<T> {
  private current: T;
  private readonly maxSize: number;
  private undoStack: T[] = [];
  private redoStack: T[] = [];
  private locked = false;
  private snapshotBeforeLock: T | undefined;
  private batchDirty = false;

  constructor(initial: T, options: HistoryOptions = {}) {
    this.current = initial;
    this.maxSize = options.maxSize ?? 50;
  }

  push(state: T): void {
    if (this.locked) {
      this.current = state;
      this.batchDirty = true;
      return;
    }
    this.undoStack.push(this.current);
    if (this.undoStack.length > this.maxSize) {
      this.undoStack.shift();
    }
    this.current = state;
    this.redoStack = [];
  }

  lock(): void {
    if (this.locked) {
      return;
    }
    this.locked = true;
    this.snapshotBeforeLock = this.current;
    this.batchDirty = false;
  }

  unlock(): void {
    if (!this.locked) {
      return;
    }
    this.locked = false;
    this.snapshotBeforeLock = undefined;
    this.batchDirty = false;
  }

  commit(): boolean {
    if (!this.locked || this.snapshotBeforeLock === undefined) {
      return false;
    }
    if (!this.batchDirty) {
      this.unlock();
      return false;
    }
    this.undoStack.push(this.snapshotBeforeLock);
    if (this.undoStack.length > this.maxSize) {
      this.undoStack.shift();
    }
    this.redoStack = [];
    this.locked = false;
    this.snapshotBeforeLock = undefined;
    this.batchDirty = false;
    return true;
  }

  discard(): T | undefined {
    if (!this.locked || this.snapshotBeforeLock === undefined) {
      return undefined;
    }
    const restoredSnapshot = this.snapshotBeforeLock;
    this.current = restoredSnapshot;
    this.locked = false;
    this.snapshotBeforeLock = undefined;
    this.batchDirty = false;
    return restoredSnapshot;
  }

  isLocked(): boolean {
    return this.locked;
  }

  isBatchDirty(): boolean {
    return this.batchDirty;
  }

  undo(): T | undefined {
    const previous = this.undoStack.pop();
    if (previous === undefined) {
      return undefined;
    }
    this.redoStack.push(this.current);
    this.current = previous;
    return this.current;
  }

  redo(): T | undefined {
    const next = this.redoStack.pop();
    if (next === undefined) {
      return undefined;
    }
    this.undoStack.push(this.current);
    this.current = next;
    return this.current;
  }

  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  getCurrent(): T {
    return this.current;
  }

  clear(initial: T): void {
    this.current = initial;
    this.undoStack = [];
    this.redoStack = [];
  }

  getSize(): number {
    return this.undoStack.length;
  }

  exportSnapshot(): HistorySnapshot<T> {
    return {
      current: this.current,
      undoStack: [...this.undoStack],
      redoStack: [...this.redoStack],
    };
  }

  importSnapshot(snapshot: HistorySnapshot<T>): void {
    this.current = snapshot.current;
    this.undoStack = [...snapshot.undoStack];
    this.redoStack = [...snapshot.redoStack];
    this.locked = false;
    this.snapshotBeforeLock = undefined;
    this.batchDirty = false;
  }
}
