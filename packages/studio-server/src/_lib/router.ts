import type { Logger } from './logger';

export interface MessageHandler<TMessage, TConnection> {
    readonly priority: number;
    handle(message: TMessage, client: TConnection): Promise<void>;
}

export interface MessageRouterInterface<TMessageType, TMessage, TConnection> {
    registerHandler(messageType: TMessageType, handler: MessageHandler<TMessage, TConnection>): void;
    unregisterHandler(messageType: TMessageType, handler: MessageHandler<TMessage, TConnection>): void;
    route(messageType: TMessageType, message: TMessage, client: TConnection): Promise<void>;
    getRegisteredMessageTypes(): TMessageType[];
    getHandlersForMessageType(messageType: TMessageType): MessageHandler<TMessage, TConnection>[];
    hasHandlersForMessageType(messageType: TMessageType): boolean;
}

export class MessageRouter<TMessageType, TMessage, TConnection> implements MessageRouterInterface<TMessageType, TMessage, TConnection> {
    private handlers: Map<TMessageType, Set<MessageHandler<TMessage, TConnection>>> = new Map();

    constructor(private readonly logger: Logger) { }

    registerHandler(messageType: TMessageType, handler: MessageHandler<TMessage, TConnection>): void {
        if (!this.handlers.has(messageType)) {
            this.handlers.set(messageType, new Set());
        }
        this.handlers.get(messageType)!.add(handler);
        this.logger.debug('Handler registered', { messageType: String(messageType), priority: handler.priority });
    }

    unregisterHandler(messageType: TMessageType, handler: MessageHandler<TMessage, TConnection>): void {
        if (!this.handlers.has(messageType)) return;

        this.handlers.get(messageType)!.delete(handler);

        if (this.handlers.get(messageType)!.size === 0) {
            this.handlers.delete(messageType);
        }
    }

    async route(messageType: TMessageType, message: TMessage, client: TConnection): Promise<void> {
        if (!this.handlers.has(messageType)) {
            this.logger.debug('No handlers for message type', { messageType: String(messageType) });
            return;
        }

        const messageHandlers = Array.from(this.handlers.get(messageType)!);
        messageHandlers.sort((a, b) => a.priority - b.priority);

        for (const handler of messageHandlers) {
            try {
                await handler.handle(message, client);
            } catch (error) {
                this.logger.error('Error in message handler', { messageType: String(messageType), error: String(error) });
            }
        }
    }

    getRegisteredMessageTypes(): TMessageType[] {
        return Array.from(this.handlers.keys());
    }

    getHandlersForMessageType(messageType: TMessageType): MessageHandler<TMessage, TConnection>[] {
        if (!this.handlers.has(messageType)) return [];
        return Array.from(this.handlers.get(messageType)!);
    }

    hasHandlersForMessageType(messageType: TMessageType): boolean {
        return this.handlers.has(messageType) && this.handlers.get(messageType)!.size > 0;
    }
}
