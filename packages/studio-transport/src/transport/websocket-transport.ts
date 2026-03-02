import { Transport, Unsubscribe } from "./types";

export interface WebSocketTransportOptions {
    reconnectDelayMs?: number;       // Default: 1000
    maxReconnectDelayMs?: number;    // Default: 30000
    WebSocketImpl?: typeof WebSocket;
}

export class WebSocketTransport implements Transport {
    private ws: WebSocket | null = null;
    private onMessageHandlers = new Set<(data: string) => void>();
    private onOpenHandlers = new Set<() => void>();
    private onCloseHandlers = new Set<() => void>();

    private currentReconnectDelay: number;
    private readonly maxReconnectDelay: number;
    private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
    private intentionallyClosed = false;
    private readonly WebSocketConstructor: typeof WebSocket;

    constructor(
        public readonly url: string,
        private readonly options?: WebSocketTransportOptions
    ) {
        this.currentReconnectDelay = options?.reconnectDelayMs ?? 1000;
        this.maxReconnectDelay = options?.maxReconnectDelayMs ?? 30000;

        const WsCtor = options?.WebSocketImpl ?? globalThis.WebSocket;
        if (!WsCtor) {
            throw new Error("WebSocketImpl not provided and global WebSocket is not available in this environment.");
        }
        this.WebSocketConstructor = WsCtor;

        this.connect();
    }

    private connect(): void {
        if (this.intentionallyClosed) return;

        try {
            this.ws = new this.WebSocketConstructor(this.url);

            this.ws.onopen = () => {
                this.currentReconnectDelay = this.options?.reconnectDelayMs ?? 1000;
                for (const h of this.onOpenHandlers) h();
            };

            this.ws.onmessage = (event) => {
                const data = typeof event.data === 'string' ? event.data : String(event.data);
                for (const h of this.onMessageHandlers) h(data);
            };

            this.ws.onclose = () => {
                this.ws = null;
                for (const h of this.onCloseHandlers) h();
                this.scheduleReconnect();
            };

            this.ws.onerror = () => {
                // Ignore error, onclose will fire and trigger reconnect
            };
        } catch (e) {
            this.scheduleReconnect();
        }
    }

    private scheduleReconnect(): void {
        if (this.intentionallyClosed) return;

        if (this.reconnectTimeout === null) {
            this.reconnectTimeout = setTimeout(() => {
                this.reconnectTimeout = null;
                this.currentReconnectDelay = Math.min(this.currentReconnectDelay * 2, this.maxReconnectDelay);
                this.connect();
            }, this.currentReconnectDelay);
        }
    }

    send(data: string): void {
        if (this.isConnected && this.ws) {
            this.ws.send(data);
        }
    }

    onMessage(handler: (data: string) => void): Unsubscribe {
        this.onMessageHandlers.add(handler);
        return () => this.onMessageHandlers.delete(handler);
    }

    onOpen(handler: () => void): Unsubscribe {
        this.onOpenHandlers.add(handler);
        return () => this.onOpenHandlers.delete(handler);
    }

    onClose(handler: () => void): Unsubscribe {
        this.onCloseHandlers.add(handler);
        return () => this.onCloseHandlers.delete(handler);
    }

    close(): void {
        this.intentionallyClosed = true;

        if (this.reconnectTimeout !== null) {
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = null;
        }

        if (this.ws) {
            this.ws.onclose = null; // Don't trigger standard close handler on intentional close
            this.ws.close();
            this.ws = null;
            for (const h of this.onCloseHandlers) h();
        }
    }

    get isConnected(): boolean {
        return this.ws !== null && this.ws.readyState === this.WebSocketConstructor.OPEN;
    }
}
