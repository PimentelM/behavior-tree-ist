import { useEffect, useRef, useState, useCallback } from 'react';
import { UiInboundMessageSchema } from '@behavior-tree-ist/studio-common';
import type { UiInboundMessage } from '@behavior-tree-ist/studio-common';

export type WsEvent = UiInboundMessage | { t: 'reconnect' };
export type WsListener = (event: WsEvent) => void;
export type WsSubscribe = (listener: WsListener) => () => void;

export function useUiWebSocket(): WsSubscribe {
    const listenersRef = useRef(new Set<WsListener>());
    const [reconnectKey, setReconnectKey] = useState(0);

    useEffect(() => {
        const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
        const ws = new WebSocket(`${protocol}//${location.host}/ui-ws`);

        ws.onmessage = (event) => {
            try {
                const parsed = UiInboundMessageSchema.parse(JSON.parse(event.data));
                for (const listener of listenersRef.current) {
                    listener(parsed);
                }
            } catch {
                console.log('[ui-ws] failed to parse message', event.data);
            }
        };

        ws.onclose = () => {
            setTimeout(() => setReconnectKey((k) => k + 1), 3000);
        };

        ws.onerror = () => {
            ws.close();
        };

        if (reconnectKey > 0) {
            ws.onopen = () => {
                for (const listener of listenersRef.current) {
                    listener({ t: 'reconnect' });
                }
            };
        }

        return () => {
            ws.onclose = null;
            ws.close();
        };
    }, [reconnectKey]);

    const subscribe: WsSubscribe = useCallback((listener: WsListener) => {
        listenersRef.current.add(listener);
        return () => { listenersRef.current.delete(listener); };
    }, []);

    return subscribe;
}
