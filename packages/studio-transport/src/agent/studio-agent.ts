import { OutboundQueue } from "./outbound-queue";
import { StudioAgentOptions } from "./types";
import { TreeRegistry, computeHash } from "../registry/tree-registry";
import { Transport, Unsubscribe } from "../transport/types";
import {
    AgentToServerMessage,
    ServerToAgentMessage,
    MessageType,
    CommandType,
    PROTOCOL_VERSION
} from "../protocol";

export class StudioAgent {
    private readonly queue: OutboundQueue<AgentToServerMessage>;
    private transport: Transport | null = null;
    private subscriptions: Unsubscribe[] = [];
    private connected = false;
    private readonly knownHashes = new Map<string, string>();

    constructor(
        public readonly clientId: string,
        private readonly registry: TreeRegistry,
        options?: StudioAgentOptions
    ) {
        this.queue = new OutboundQueue(options?.queueCapacity ?? 1000);
    }

    public get isConnected(): boolean {
        return this.connected;
    }

    public connect(transport: Transport): void {
        this.disconnect();
        this.transport = transport;

        this.subscriptions.push(
            transport.onOpen(() => this.handleTransportOpen()),
            transport.onClose(() => this.handleTransportClose()),
            transport.onMessage((msg) => this.handleTransportMessage(msg)),

            this.registry.onTreeRegistered((entry) => {
                this.knownHashes.set(entry.treeId, entry.serializedTreeHash);
                if (this.isConnected) {
                    this.queueMessage({
                        v: PROTOCOL_VERSION,
                        type: MessageType.RegisterTree,
                        payload: {
                            treeId: entry.treeId,
                            serializedTree: entry.serializedTree
                        }
                    });
                }
            }),

            this.registry.onTreeRemoved((treeId) => {
                this.knownHashes.delete(treeId);
                if (this.isConnected) {
                    this.queueMessage({
                        v: PROTOCOL_VERSION,
                        type: MessageType.RemoveTree,
                        payload: { treeId }
                    });
                }
            }),

            this.registry.onTick((treeId, record) => {
                if (this.registry.isStreaming(treeId)) {
                    this.queueMessage({
                        v: PROTOCOL_VERSION,
                        type: MessageType.TickBatch,
                        payload: { treeId, ticks: [record] }
                    });
                }

                // Track structure changes during ticks
                const entry = this.registry.get(treeId);
                if (entry) {
                    const newTree = entry.tree.toJSON();
                    const newHash = computeHash(JSON.stringify(newTree));
                    const oldHash = this.knownHashes.get(treeId);

                    // Simple hash mechanism: simply comparing string length + content for simplicity
                    if (oldHash !== undefined && oldHash !== newHash) {
                        this.knownHashes.set(treeId, newHash);
                        this.queueMessage({
                            v: PROTOCOL_VERSION,
                            type: MessageType.TreeUpdate,
                            payload: { treeId, serializedTree: newTree }
                        });
                    }
                }
            })
        );

        if (transport.isConnected) {
            this.handleTransportOpen();
        }
    }

    public disconnect(): void {
        for (const unsub of this.subscriptions) {
            unsub();
        }
        this.subscriptions = [];
        this.transport?.close();
        this.transport = null;
        this.connected = false;
    }

    public tick(ctx: { now: number }): void {
        if (!this.isConnected || !this.transport) {
            return;
        }

        const messages = this.queue.drain();
        for (const msg of messages) {
            this.transport.send(JSON.stringify(msg));
        }
    }

    private handleTransportOpen(): void {
        this.connected = true;

        this.queueMessage({
            v: PROTOCOL_VERSION,
            type: MessageType.ClientHello,
            payload: { clientId: this.clientId }
        });

        for (const entry of this.registry.getAll().values()) {
            this.knownHashes.set(entry.treeId, entry.serializedTreeHash);
            this.queueMessage({
                v: PROTOCOL_VERSION,
                type: MessageType.RegisterTree,
                payload: {
                    treeId: entry.treeId,
                    serializedTree: entry.serializedTree
                }
            });
        }
    }

    private handleTransportClose(): void {
        this.connected = false;
    }

    private handleTransportMessage(data: string): void {
        try {
            const msg: ServerToAgentMessage = JSON.parse(data);

            if (msg.type === MessageType.ServerHello) {
                // No-op
            } else if (msg.type === MessageType.Command) {
                this.handleCommand(msg.payload.treeId, msg.payload.command, msg.payload.correlationId);
            }
        } catch (e) {
            console.error("StudioAgent: Failed to parse incoming message", e);
        }
    }

    private handleCommand(treeId: string, command: string, correlationId: string): void {
        const entry = this.registry.get(treeId);

        if (!entry) {
            this.sendAck(correlationId, false, `Tree "${treeId}" not found`);
            return;
        }

        try {
            switch (command) {
                case CommandType.EnableStreaming:
                    this.registry.enableStreaming(treeId);
                    break;
                case CommandType.DisableStreaming:
                    this.registry.disableStreaming(treeId);
                    break;
                case CommandType.EnableStateTrace:
                    entry.tree.enableStateTrace();
                    break;
                case CommandType.DisableStateTrace:
                    entry.tree.disableStateTrace();
                    break;
                case CommandType.EnableProfiling:
                    entry.tree.enableProfiling();
                    break;
                case CommandType.DisableProfiling:
                    entry.tree.disableProfiling();
                    break;
                default:
                    this.sendAck(correlationId, false, `Unknown command "${command}"`);
                    return;
            }
            this.sendAck(correlationId, true);
        } catch (error: any) {
            this.sendAck(correlationId, false, error.message ?? String(error));
        }
    }

    private sendAck(correlationId: string, success: boolean, error?: string): void {
        this.queueMessage({
            v: PROTOCOL_VERSION,
            type: MessageType.CommandAck,
            payload: { correlationId, success, error }
        });
    }

    private queueMessage(msg: AgentToServerMessage): void {
        this.queue.push(msg);
    }
}
