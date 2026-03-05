import { InboundMessage, OutboundMessage, TransportData } from '@behavior-tree-ist/core';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function serializeMessageAsBinaryJson(message: OutboundMessage): Uint8Array {
    return encoder.encode(JSON.stringify(message));
}

export function deserializeJsonTransportMessage(data: TransportData): InboundMessage {
    if (typeof data === 'string') {
        return JSON.parse(data) as InboundMessage;
    }

    return JSON.parse(decoder.decode(data)) as InboundMessage;
}
