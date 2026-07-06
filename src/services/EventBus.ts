export interface PreviewEvents {
    'preview:started': { docUri: string };
    'preview:finished': { docUri: string; tempFilePath: string };
    'preview:failed': { docUri: string; error: string };
    'config:changed': any;
    'log': { level: 'info' | 'warn' | 'error'; message: string };
}

export type EventCallback<T> = (data: T) => void | Promise<void>;

export class EventBus {
    private readonly listeners = new Map<string, Set<EventCallback<any>>>();

    subscribe<K extends keyof PreviewEvents>(
        event: K,
        callback: EventCallback<PreviewEvents[K]>
    ): () => void {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        this.listeners.get(event)!.add(callback);
        return () => {
            const set = this.listeners.get(event);
            if (set) {
                set.delete(callback);
            }
        };
    }

    publish<K extends keyof PreviewEvents>(event: K, data: PreviewEvents[K]): void {
        const set = this.listeners.get(event);
        if (set) {
            for (const callback of set) {
                try {
                    callback(data);
                } catch (err) {
                    console.error(`Error in event listener for ${event}:`, err);
                }
            }
        }
    }
}
