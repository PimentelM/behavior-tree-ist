import { type WebSocketServerInterface } from './interfaces';
import { WSWebSocketClient } from './websocket-client';
import { type Logger } from '../logging';
import { GenericWebSocketServer } from '../../_lib/server/generic-ws-server';
import { type OutboundMessage } from '@bt-studio/core';
import { type MessageConnectionInterface } from '../../types/interfaces';

export class WSWebSocketServer extends GenericWebSocketServer<OutboundMessage, object, MessageConnectionInterface> implements WebSocketServerInterface {
    constructor(logger: Logger) {
        super(logger, {
            createClient(id, socket) {
                return new WSWebSocketClient(id, socket);
            }
        });
    }
}

export function createWebSocketServer(logger: Logger): WebSocketServerInterface {
    return new WSWebSocketServer(logger);
}
