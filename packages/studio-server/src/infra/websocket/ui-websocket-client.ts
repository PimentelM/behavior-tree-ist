import WebSocket from 'ws';
import { UiInboundMessage, UiOutboundMessage, UiOutboundMessageSchema } from '@behavior-tree-ist/studio-common';
import { createLogger } from '../logging';
import { GenericWebSocketClient } from '../../_lib/server/generic-ws-client';
import type { ConnectionSerializer } from '../../_lib/connection';

class UiMessageSerializer implements ConnectionSerializer<UiOutboundMessage, UiInboundMessage> {
    serialize(message: UiInboundMessage): string {
        return JSON.stringify(message);
    }

    deserialize(raw: string | Uint8Array): UiOutboundMessage | undefined {
        const rawText = typeof raw === 'string' ? raw : new TextDecoder().decode(raw);
        try {
            const rawObj = JSON.parse(rawText) as unknown;
            const parsed = UiOutboundMessageSchema.safeParse(rawObj);

            if (!parsed.success) {
                return undefined;
            }

            return parsed.data;
        } catch {
            return undefined;
        }
    }
}

export class UiWebSocketClient extends GenericWebSocketClient<UiOutboundMessage, UiInboundMessage> {
    constructor(
        id: string,
        socket: WebSocket
    ) {
        const logger = createLogger(`ui-ws-client:${id.slice(0, 8)}`);
        super(id, socket, {
            logger,
            serializer: new UiMessageSerializer()
        });
    }
}
