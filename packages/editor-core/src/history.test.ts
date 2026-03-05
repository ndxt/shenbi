import { describe, expect, it } from 'vitest';
import { History } from './history';

describe('History', () => {
  it('supports push/undo/redo chain', () => {
    const history = new History<number>(0);
    history.push(1);
    history.push(2);

    expect(history.canUndo()).toBe(true);
    expect(history.getCurrent()).toBe(2);
    expect(history.undo()).toBe(1);
    expect(history.undo()).toBe(0);
    expect(history.undo()).toBeUndefined();
    expect(history.canRedo()).toBe(true);
    expect(history.redo()).toBe(1);
    expect(history.redo()).toBe(2);
  });

  it('drops oldest undo state when maxSize exceeded', () => {
    const history = new History<number>(0, { maxSize: 2 });
    history.push(1);
    history.push(2);
    history.push(3);

    expect(history.getSize()).toBe(2);
    expect(history.undo()).toBe(2);
    expect(history.undo()).toBe(1);
    expect(history.undo()).toBeUndefined();
  });

  it('clears redo stack after new push', () => {
    const history = new History<number>(0);
    history.push(1);
    history.push(2);
    expect(history.undo()).toBe(1);
    expect(history.canRedo()).toBe(true);

    history.push(3);
    expect(history.canRedo()).toBe(false);
  });
});
