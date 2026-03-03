import { OutboundMessage } from '@behavior-tree-ist/core';
import { MessageType } from '@behavior-tree-ist/core';

export type MessageTransport = 'websocket' | 'tcp';

export interface MessageConnectionInterface {
    id: string;
    transport: MessageTransport;
    send(message: object): void;
    disconnect(): void;
    onMessage(handler: (message: OutboundMessage) => void | Promise<void>): void;
    onDisconnect(handler: () => void): void;
    isConnected(): boolean;
}

export interface MessageServerInterface<TConfig, TConnectionContext> {
    start(config: TConfig): Promise<void>;
    stop(): Promise<void>;
    broadcast(message: object): void;
    sendToClient(clientId: string, message: object): void;
    onConnection(handler: (client: MessageConnectionInterface, context: TConnectionContext) => void): void;
    onDisconnection(handler: (clientId: string) => void): void;
    getClient(clientId: string): MessageConnectionInterface | undefined;
    getClients(): Map<string, MessageConnectionInterface>;
    getClientCount(): number;
}

export interface MessageHandler {
    priority: number;
    handle(message: OutboundMessage, client: MessageConnectionInterface): Promise<void>;
}

export interface MessageRouterInterface {
    registerHandler(messageType: MessageType, handler: MessageHandler): void;
    unregisterHandler(messageType: MessageType, handler: MessageHandler): void;
    route(messageType: MessageType, message: OutboundMessage, client: MessageConnectionInterface): Promise<void>;
    getRegisteredMessageTypes(): MessageType[];
    getHandlersForMessageType(messageType: MessageType): MessageHandler[];
    hasHandlersForMessageType(messageType: MessageType): boolean;
}
