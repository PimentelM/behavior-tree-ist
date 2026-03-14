import { type OutboundMessage } from '@bt-studio/core';
import { type MessageType } from '@bt-studio/core';
import { type Connection, type Server } from '../_lib/connection';
import { type MessageHandler as GenericMessageHandler, type MessageRouterInterface as GenericMessageRouterInterface } from '../_lib/router';

export type MessageTransport = 'websocket' | 'tcp';

export interface MessageConnectionInterface extends Connection<OutboundMessage, object> {
    transport: MessageTransport;
}

export type MessageServerInterface<TConfig, TConnectionContext> = Server<TConfig, TConnectionContext, OutboundMessage, object, MessageConnectionInterface>;

export type MessageHandler = GenericMessageHandler<OutboundMessage, MessageConnectionInterface>;

export type MessageRouterInterface = GenericMessageRouterInterface<MessageType, OutboundMessage, MessageConnectionInterface>;
