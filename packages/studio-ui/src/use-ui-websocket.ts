import { useEffect, useRef, useState, useCallback } from 'react';
import { UiInboundMessageSchema } from '@bt-studio/studio-common';
import type { UiInboundMessage } from '@bt-studio/studio-common';

export type WsEvent = UiInboundMessage | { t: 'reconnect' };
export type WsListener = (event: WsEvent) => void;
export type WsSubscribe = (listener: WsListener) => () => void;

export function useUiWebSocket(): WsSubscribe {
    const listenersRef = useRef(new Set<WsListener>());
    const [reconnectKey, setReconnectKey] = useState(0);

    useEffect(() => {
        let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
        const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
        const ws = new WebSocket(`${protocol}//${location.host}/ui-ws`);

        ws.onmessage = (event) => {
            try {
                const parsed = UiInboundMessageSchema.parse(JSON.parse(event.data as string));
                for (const listener of listenersRef.current) {
                    listener(parsed);
                }
            } catch {
                // eslint-disable-next-line no-console
                console.log('[ui-ws] failed to parse message', event.data);
            }
        };

        ws.onclose = () => {
            reconnectTimer = setTimeout(() => { setReconnectKey((k) => k + 1); }, 3000);
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
            if (reconnectTimer !== null) clearTimeout(reconnectTimer);
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
