import WebSocket from 'ws';
import { OutboundMessage } from '@behavior-tree-ist/core';
import { MessageConnectionInterface } from '../../types/interfaces';
import { createLogger } from '../logging';
import { OutboundMessageSchema } from '../../domain/bt-core-types';
import { GenericWebSocketClient } from '../../lib/server/generic-ws-client';
import type { ConnectionSerializer } from '../../lib/connection';

class JsonMessageSerializer implements ConnectionSerializer<OutboundMessage, object> {
    serialize(message: object): string {
        return JSON.stringify(message);
    }

    deserialize(raw: string | Uint8Array): OutboundMessage | undefined {
        const rawText = typeof raw === 'string' ? raw : new TextDecoder().decode(raw);
        const rawObj = JSON.parse(rawText) as unknown;
        const parsed = OutboundMessageSchema.safeParse(rawObj);

        if (!parsed.success) {
            return undefined; // Handled/dropped by generic client or logged externally if desirable
        }

        return parsed.data as OutboundMessage;
    }
}

export class WSWebSocketClient extends GenericWebSocketClient<OutboundMessage, object> implements MessageConnectionInterface {
    constructor(
        id: string,
        socket: WebSocket
    ) {
        const logger = createLogger(`ws-client:${id.slice(0, 8)}`);
        super(id, socket, {
            logger,
            serializer: new JsonMessageSerializer()
        });
    }
}
