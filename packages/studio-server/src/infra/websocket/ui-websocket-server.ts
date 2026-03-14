import { type IncomingMessage } from 'http';
import { type Duplex } from 'stream';
import type { Server as MessageServer } from '../../_lib/connection';
import { type UiInboundMessage, type UiOutboundMessage } from '@bt-studio/studio-common';
import { UiWebSocketClient } from './ui-websocket-client';
import { type Logger } from '../logging';
import { GenericWebSocketServer } from '../../_lib/server/generic-ws-server';

export interface UiWebSocketServerConfigInterface {
    maxConnections: number;
}

export interface UiWebSocketConnectionContext {
    transport: 'websocket';
    request: IncomingMessage;
}

export interface UiWebSocketServerInterface extends MessageServer<UiWebSocketServerConfigInterface, UiWebSocketConnectionContext, UiOutboundMessage, UiInboundMessage, UiWebSocketClient> {
    handleUpgrade(request: IncomingMessage, socket: Duplex, head: Buffer): void;
}

export class UiWebSocketServer extends GenericWebSocketServer<UiOutboundMessage, UiInboundMessage, UiWebSocketClient> implements UiWebSocketServerInterface {
    constructor(logger: Logger) {
        super(logger, {
            createClient(id, socket) {
                return new UiWebSocketClient(id, socket);
            }
        });
    }
}

export function createUiWebSocketServer(logger: Logger): UiWebSocketServerInterface {
    return new UiWebSocketServer(logger);
}
