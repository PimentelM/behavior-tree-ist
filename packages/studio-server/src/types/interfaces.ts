import { OutboundMessage } from '@behavior-tree-ist/core';
import { MessageType } from '@behavior-tree-ist/core';

export interface WebSocketClientInterface {
    id: string;
    send(message: object): void;
    disconnect(): void;
    onMessage(handler: (message: OutboundMessage) => void): void;
    onDisconnect(handler: () => void): void;
    isConnected(): boolean;
}

export interface MessageHandler {
    priority: number;
    handle(message: OutboundMessage, client: WebSocketClientInterface): Promise<void>;
}

export interface MessageRouterInterface {
    registerHandler(messageType: MessageType, handler: MessageHandler): void;
    unregisterHandler(messageType: MessageType, handler: MessageHandler): void;
    route(messageType: MessageType, message: OutboundMessage, client: WebSocketClientInterface): Promise<void>;
    getRegisteredMessageTypes(): MessageType[];
    getHandlersForMessageType(messageType: MessageType): MessageHandler[];
    hasHandlersForMessageType(messageType: MessageType): boolean;
}
