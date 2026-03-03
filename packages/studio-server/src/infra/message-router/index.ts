import { MessageType, OutboundMessage } from '@behavior-tree-ist/core';
import { MessageConnectionInterface, MessageHandler, MessageRouterInterface } from '../../types/interfaces';
import { createLogger } from '../logging';

export class MessageRouter implements MessageRouterInterface {
    private handlers: Map<MessageType, Set<MessageHandler>> = new Map();
    private logger = createLogger('message-router');

    registerHandler(messageType: MessageType, handler: MessageHandler): void {
        if (!this.handlers.has(messageType)) {
            this.handlers.set(messageType, new Set());
        }
        this.handlers.get(messageType)!.add(handler);
        this.logger.debug('Handler registered', { messageType, priority: handler.priority });
    }

    unregisterHandler(messageType: MessageType, handler: MessageHandler): void {
        if (!this.handlers.has(messageType)) return;

        this.handlers.get(messageType)!.delete(handler);

        if (this.handlers.get(messageType)!.size === 0) {
            this.handlers.delete(messageType);
        }
    }

    async route(messageType: MessageType, message: OutboundMessage, client: MessageConnectionInterface): Promise<void> {
        if (!this.handlers.has(messageType)) {
            this.logger.debug('No handlers for message type', { messageType });
            return;
        }

        const messageHandlers = Array.from(this.handlers.get(messageType)!);
        messageHandlers.sort((a, b) => a.priority - b.priority);

        for (const handler of messageHandlers) {
            try {
                await handler.handle(message, client);
            } catch (error) {
                this.logger.error('Error in message handler', { messageType, error: String(error) });
            }
        }
    }

    getRegisteredMessageTypes(): MessageType[] {
        return Array.from(this.handlers.keys());
    }

    getHandlersForMessageType(messageType: MessageType): MessageHandler[] {
        if (!this.handlers.has(messageType)) return [];
        return Array.from(this.handlers.get(messageType)!);
    }

    hasHandlersForMessageType(messageType: MessageType): boolean {
        return this.handlers.has(messageType) && this.handlers.get(messageType)!.size > 0;
    }
}
