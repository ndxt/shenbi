export class EventBus<T extends object> {
  private handlers = new Map<keyof T, Set<(payload: unknown) => void>>();

  on<K extends keyof T>(event: K, handler: (payload: T[K]) => void): () => void {
    let eventHandlers = this.handlers.get(event);
    if (!eventHandlers) {
      eventHandlers = new Set<(payload: unknown) => void>();
      this.handlers.set(event, eventHandlers);
    }
    const wrapped = handler as (payload: unknown) => void;
    eventHandlers.add(wrapped);
    return () => this.off(event, handler);
  }

  emit<K extends keyof T>(event: K, payload: T[K]): void {
    const eventHandlers = this.handlers.get(event);
    if (!eventHandlers || eventHandlers.size === 0) {
      return;
    }
    for (const handler of eventHandlers) {
      handler(payload);
    }
  }

  off<K extends keyof T>(event: K, handler: (payload: T[K]) => void): void {
    const eventHandlers = this.handlers.get(event);
    if (!eventHandlers) {
      return;
    }
    eventHandlers.delete(handler as (payload: unknown) => void);
    if (eventHandlers.size === 0) {
      this.handlers.delete(event);
    }
  }

  clear(): void {
    this.handlers.clear();
  }
}
