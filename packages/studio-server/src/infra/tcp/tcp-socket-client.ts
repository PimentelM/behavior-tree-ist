import type { Socket } from 'net';
import type { OutboundMessage } from '@bt-studio/core';
import { OutboundMessageSchema } from '../../domain/core-schemas';
import { createLogger } from '../logging';
import type { MessageConnectionInterface } from '../../types/interfaces';
import { GenericTcpClient } from '../../_lib/server/generic-tcp-client';
import type { ConnectionSerializer } from '../../_lib/connection';

const textDecoder = new TextDecoder();

class JsonMessageSerializer implements ConnectionSerializer<OutboundMessage, object> {
    serialize(message: object): string {
        return JSON.stringify(message);
    }

    deserialize(raw: Uint8Array): OutboundMessage | undefined {
        const rawText = textDecoder.decode(raw);
        const rawObj = JSON.parse(rawText) as unknown;
        const parsed = OutboundMessageSchema.safeParse(rawObj);

        if (!parsed.success) {
            return undefined; // Handled/dropped by generic client or logged externally if desirable
        }

        return parsed.data as OutboundMessage;
    }
}

export class TCPSocketClient extends GenericTcpClient<OutboundMessage, object> implements MessageConnectionInterface {
    constructor(
        id: string,
        socket: Socket,
    ) {
        const logger = createLogger(`tcp-client:${id.slice(0, 8)}`);
        super(id, socket, {
            logger,
            serializer: new JsonMessageSerializer()
        });
    }
}
