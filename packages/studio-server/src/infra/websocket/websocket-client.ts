import type WebSocket from 'ws';
import { type OutboundMessage } from '@bt-studio/core';
import { type MessageConnectionInterface } from '../../types/interfaces';
import { createLogger } from '../logging';
import { OutboundMessageSchema } from '../../domain/core-schemas';
import { GenericWebSocketClient } from '../../_lib/server/generic-ws-client';
import type { ConnectionSerializer } from '../../_lib/connection';
import type { Logger } from '../logging';

class JsonMessageSerializer implements ConnectionSerializer<OutboundMessage, object> {
    constructor(private readonly logger: Logger) {}

    serialize(message: object): string {
        return JSON.stringify(message);
    }

    deserialize(raw: string | Uint8Array): OutboundMessage | undefined {
        const rawText = typeof raw === 'string' ? raw : new TextDecoder().decode(raw);
        const rawObj = JSON.parse(rawText) as unknown;
        const parsed = OutboundMessageSchema.safeParse(rawObj);

        if (!parsed.success) {
            this.logger.warn('WebSocket message deserialization failed', {
                error: parsed.error.message,
            });
            return undefined;
        }

        return parsed.data;
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
            serializer: new JsonMessageSerializer(logger)
        });
    }
}
