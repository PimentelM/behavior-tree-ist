import type { Logger } from '../logging';
import type { RawTcpServerInterface } from './interfaces';
import { TCPSocketClient } from './tcp-socket-client';
import { GenericTcpServer } from '../../_lib/server/generic-tcp-server';
import { OutboundMessage } from '@bt-studio/core';
import { MessageConnectionInterface } from '../../types/interfaces';

export class RawTcpServer extends GenericTcpServer<OutboundMessage, object, MessageConnectionInterface> implements RawTcpServerInterface {
    constructor(logger: Logger) {
        super(logger, {
            createClient(id, socket) {
                return new TCPSocketClient(id, socket);
            }
        });
    }
}

export function createRawTcpServer(logger: Logger): RawTcpServerInterface {
    return new RawTcpServer(logger);
}
