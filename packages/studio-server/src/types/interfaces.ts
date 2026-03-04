import { OutboundMessage } from '@behavior-tree-ist/core';
import { MessageType } from '@behavior-tree-ist/core';
import { Connection, Server } from '../lib/connection';
import { MessageHandler as GenericMessageHandler, MessageRouterInterface as GenericMessageRouterInterface } from '../lib/router';

export type MessageTransport = 'websocket' | 'tcp';

export interface MessageConnectionInterface extends Connection<OutboundMessage, object> {
    transport: MessageTransport;
}

export type MessageServerInterface<TConfig, TConnectionContext> = Server<TConfig, TConnectionContext, OutboundMessage, object, MessageConnectionInterface>;

export type MessageHandler = GenericMessageHandler<OutboundMessage, MessageConnectionInterface>;

export type MessageRouterInterface = GenericMessageRouterInterface<MessageType, OutboundMessage, MessageConnectionInterface>;
