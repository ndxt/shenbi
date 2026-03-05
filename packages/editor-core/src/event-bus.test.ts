import { describe, expect, it, vi } from 'vitest';
import { EventBus } from './event-bus';

interface TestEvents {
  ping: { value: number };
  clear: void;
}

describe('EventBus', () => {
  it('supports on/emit/off', () => {
    const bus = new EventBus<TestEvents>();
    const handler = vi.fn();
    const unsubscribe = bus.on('ping', handler);

    bus.emit('ping', { value: 1 });
    expect(handler).toHaveBeenCalledWith({ value: 1 });

    unsubscribe();
    bus.emit('ping', { value: 2 });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('clears all handlers', () => {
    const bus = new EventBus<TestEvents>();
    const pingHandler = vi.fn();
    const clearHandler = vi.fn();
    bus.on('ping', pingHandler);
    bus.on('clear', clearHandler);

    bus.clear();
    bus.emit('ping', { value: 1 });
    bus.emit('clear', undefined);

    expect(pingHandler).not.toHaveBeenCalled();
    expect(clearHandler).not.toHaveBeenCalled();
  });
});
