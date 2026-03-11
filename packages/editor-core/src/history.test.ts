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

  it('batches multiple pushes into one undo point', () => {
    const history = new History<number>(0);

    history.lock();
    history.push(1);
    history.push(2);

    expect(history.isLocked()).toBe(true);
    expect(history.isBatchDirty()).toBe(true);
    expect(history.getSize()).toBe(0);

    expect(history.commit()).toBe(true);
    expect(history.isLocked()).toBe(false);
    expect(history.getCurrent()).toBe(2);
    expect(history.getSize()).toBe(1);
    expect(history.undo()).toBe(0);
  });

  it('does not create an empty undo point for clean batch commit', () => {
    const history = new History<number>(0);

    history.lock();

    expect(history.commit()).toBe(false);
    expect(history.getSize()).toBe(0);
    expect(history.canUndo()).toBe(false);
  });

  it('restores the locked snapshot when discarding a batch', () => {
    const history = new History<number>(0);
    history.push(1);

    history.lock();
    history.push(2);
    history.push(3);

    expect(history.discard()).toBe(1);
    expect(history.isLocked()).toBe(false);
    expect(history.isBatchDirty()).toBe(false);
    expect(history.getCurrent()).toBe(1);
    expect(history.canUndo()).toBe(true);
    expect(history.undo()).toBe(0);
  });

  it('unlocks without committing the batch snapshot', () => {
    const history = new History<number>(0);

    history.lock();
    history.push(1);
    history.unlock();

    expect(history.isLocked()).toBe(false);
    expect(history.isBatchDirty()).toBe(false);
    expect(history.getCurrent()).toBe(1);
    expect(history.canUndo()).toBe(false);
  });
});
