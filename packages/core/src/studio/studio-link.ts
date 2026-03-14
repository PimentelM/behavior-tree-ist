import { type SerializableNode, type TickRecord } from "../base";
import { type OffFunction } from "../types";
import { type StudioLinkInterface } from "./interfaces";
import { type InboundMessage, MessageType, type OutboundMessage, PROTOCOL_VERSION } from "./protocol";
import { type TransportInterface, type TransportData, type TransportFactory } from "./transport";
import { type CommandResponse, type CorrelationId, type StudioCommand } from "./types";

export interface StudioLinkOptions {
    createTransport: TransportFactory;
    serialize?: (message: OutboundMessage) => TransportData;
    deserialize?: (data: TransportData) => InboundMessage;
    reconnectDelayMs?: number;
}

const enum ConnectionState {
    Idle,
    Connecting,
    Connected,
    Closed,
}

function defaultSerialize(message: OutboundMessage): string {
    return JSON.stringify(message);
}

function defaultDeserialize(data: TransportData): InboundMessage {
    if (typeof data !== "string") {
        throw new Error("Default deserializer only supports JSON data. Provide a custom deserializer for binary transport.");
    }
    return JSON.parse(data) as InboundMessage;
}

export class StudioLink implements StudioLinkInterface {
    private readonly createTransport: TransportFactory;
    private readonly serialize: (message: OutboundMessage) => TransportData;
    private readonly deserialize: (data: TransportData) => InboundMessage;
    private readonly reconnectDelayMs: number;

    private state: ConnectionState = ConnectionState.Idle;
    private transport: TransportInterface | null = null;
    private _pendingOpen: Promise<void> | null = null;
    private lastConnectionAttemptAt = 0;
    private transportCleanup: OffFunction[] = [];

    private readonly commandHandlers = new Set<(command: StudioCommand) => void>();
    private readonly connectedHandlers = new Set<() => void>();
    private readonly disconnectedHandlers = new Set<() => void>();
    private readonly errorHandlers = new Set<(error: Error) => void>();

    constructor(options: StudioLinkOptions) {
        this.createTransport = options.createTransport;
        this.serialize = options.serialize ?? defaultSerialize;
        this.deserialize = options.deserialize ?? defaultDeserialize;
        this.reconnectDelayMs = options.reconnectDelayMs ?? 3000;
    }

    get isConnected(): boolean {
        return this.state === ConnectionState.Connected;
    }

    // --- Outbound ---

    sendHello(clientId: string, sessionId: string): void {
        this.sendMessage({ t: MessageType.Hello, version: PROTOCOL_VERSION, clientId, sessionId });
    }

    sendTreeRegistered(treeId: string, serializedTree: SerializableNode): void {
        this.sendMessage({ t: MessageType.TreeRegistered, treeId, serializedTree });
    }

    sendTreeRemoved(treeId: string): void {
        this.sendMessage({ t: MessageType.TreeRemoved, treeId });
    }

    sendTickBatch(treeId: string, ticks: TickRecord[]): void {
        this.sendMessage({ t: MessageType.TickBatch, treeId, ticks });
    }

    sendCommandResponse(correlationId: CorrelationId, response: CommandResponse): void {
        this.sendMessage({ t: MessageType.CommandResponse, correlationId, response });
    }

    // --- Inbound subscriptions ---

    onCommand(handler: (command: StudioCommand) => void): OffFunction {
        this.commandHandlers.add(handler);
        return () => this.commandHandlers.delete(handler);
    }

    onConnected(handler: () => void): OffFunction {
        this.connectedHandlers.add(handler);
        return () => this.connectedHandlers.delete(handler);
    }

    onDisconnected(handler: () => void): OffFunction {
        this.disconnectedHandlers.add(handler);
        return () => this.disconnectedHandlers.delete(handler);
    }

    onError(handler: (error: Error) => void): OffFunction {
        this.errorHandlers.add(handler);
        return () => this.errorHandlers.delete(handler);
    }

    // --- Lifecycle ---

    open(): void {
        if (this.state !== ConnectionState.Idle) return;
        this.attemptConnection();
    }

    close(): void {
        if (this.state === ConnectionState.Closed) return;
        const wasConnected = this.state === ConnectionState.Connected;
        this.teardownTransport();
        this.state = ConnectionState.Closed;
        this._pendingOpen = null;
        if (wasConnected) {
            this.emit(this.disconnectedHandlers);
        }
    }

    tick(): void {
        if (this.state === ConnectionState.Connecting) {
            // Promise settlement is checked via the .then/.catch handlers attached in attemptConnection.
            // tick() is a no-op while connecting — settlement handlers drive state transitions.
            return;
        }

        if (this.state === ConnectionState.Idle) {
            const now = Date.now();
            if (now - this.lastConnectionAttemptAt >= this.reconnectDelayMs) {
                this.attemptConnection();
            }
        }
    }

    // --- Internal ---

    private attemptConnection(): void {
        this.lastConnectionAttemptAt = Date.now();
        this.state = ConnectionState.Connecting;

        const transport = this.createTransport();
        this.transport = transport;

        this._pendingOpen = transport.open().then(
            () => {
                // Guard: transport may have been discarded by close() or a new attempt
                if (this.transport !== transport) return;
                // Subscribe to transport events after connection is established
                this.transportCleanup.push(
                    transport.onMessage((data) => this.handleTransportMessage(data)),
                    transport.onError((error) => this.emit(this.errorHandlers, error)),
                    transport.onClose(() => this.handleTransportClose()),
                );
                this.state = ConnectionState.Connected;
                this._pendingOpen = null;
                this.emit(this.connectedHandlers);
            },
            (error: unknown) => {
                if (this.transport !== transport) return;
                this.teardownTransport();
                this.state = ConnectionState.Idle;
                this._pendingOpen = null;
                const err = error instanceof Error ? error : new Error(String(error));
                this.emit(this.errorHandlers, err);
            },
        );
    }

    private handleTransportMessage(data: TransportData): void {
        let message: InboundMessage;
        try {
            message = this.deserialize(data);
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            this.emit(this.errorHandlers, err);
            return;
        }

        if (message.t === MessageType.Command) {
            this.emit(this.commandHandlers, message.command);
        }
    }

    private handleTransportClose(): void {
        if (this.state === ConnectionState.Closed) return;
        const wasConnected = this.state === ConnectionState.Connected;
        this.teardownTransport();
        this.state = ConnectionState.Idle;
        this._pendingOpen = null;
        if (wasConnected) {
            this.emit(this.disconnectedHandlers);
        }
    }

    private sendMessage(message: OutboundMessage): void {
        if (this.state !== ConnectionState.Connected || !this.transport) return;
        this.transport.send(this.serialize(message));
    }

    private teardownTransport(): void {
        for (const unsub of this.transportCleanup) {
            unsub();
        }
        this.transportCleanup.length = 0;
        if (this.transport) {
            this.transport.close();
            this.transport = null;
        }
    }

    private emit(handlers: Set<() => void>): void;
    private emit<T>(handlers: Set<(arg: T) => void>, arg: T): void;
    private emit<T>(handlers: Set<(arg?: T) => void>, arg?: T): void {
        for (const handler of handlers) {
            handler(arg);
        }
    }
}
