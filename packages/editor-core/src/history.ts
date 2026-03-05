export interface HistoryOptions {
  maxSize?: number;
}

export class History<T> {
  private current: T;
  private readonly maxSize: number;
  private undoStack: T[] = [];
  private redoStack: T[] = [];

  constructor(initial: T, options: HistoryOptions = {}) {
    this.current = initial;
    this.maxSize = options.maxSize ?? 50;
  }

  push(state: T): void {
    this.undoStack.push(this.current);
    if (this.undoStack.length > this.maxSize) {
      this.undoStack.shift();
    }
    this.current = state;
    this.redoStack = [];
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
}
