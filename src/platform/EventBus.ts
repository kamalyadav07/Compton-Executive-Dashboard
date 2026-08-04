type EventHandler<T = any> = (payload: T) => Promise<void> | void;

export class EventBus {
  private handlers: Map<string, EventHandler[]> = new Map();
  private eventHistory: { topic: string; timestamp: string; payloadSummary: string }[] = [];

  public subscribe<T = any>(topic: string, handler: EventHandler<T>): () => void {
    if (!this.handlers.has(topic)) {
      this.handlers.set(topic, []);
    }
    this.handlers.get(topic)!.push(handler);

    return () => {
      const list = this.handlers.get(topic) || [];
      this.handlers.set(topic, list.filter(h => h !== handler));
    };
  }

  public async publish<T = any>(topic: string, payload: T): Promise<void> {
    const list = this.handlers.get(topic) || [];
    this.eventHistory.unshift({
      topic,
      timestamp: new Date().toISOString(),
      payloadSummary: typeof payload === 'object' ? JSON.stringify(payload).substring(0, 100) : String(payload)
    });
    if (this.eventHistory.length > 200) {
      this.eventHistory.pop();
    }

    for (const handler of list) {
      try {
        await handler(payload);
      } catch (err) {
        console.error(`[EventBus] Error handling topic '${topic}':`, err);
      }
    }
  }

  public getHistory() {
    return this.eventHistory;
  }

  public clearHistory() {
    this.eventHistory = [];
  }
}

export const globalEventBus = new EventBus();
