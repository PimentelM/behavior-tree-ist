import { useEffect, useState, useRef } from 'react';
import type { StudioClientInfo } from '@bt-studio/react';
import { trpc } from '../trpc';
import type { WsSubscribe } from '../use-ui-websocket';

export function useClients(subscribe: WsSubscribe) {
    const [clients, setClients] = useState<StudioClientInfo[]>([]);
    const [loading, setLoading] = useState(true);
    const mountedRef = useRef(true);

    useEffect(() => {
        mountedRef.current = true;
        return () => { mountedRef.current = false; };
    }, []);

    const fetchClients = () => {
        trpc.clients.getAll.query().then((result) => {
            if (!mountedRef.current) return;
            setClients(result.map((c) => ({
                clientId: c.clientId,
                firstSeenAt: c.firstSeenAt,
                lastSeenAt: c.lastSeenAt,
                status: c.online ? 'online' as const : 'offline' as const,
            })));
            setLoading(false);
        }).catch((err) => {
            console.log('[use-clients] fetch error', err);
            if (mountedRef.current) setLoading(false);
        });
    };

    useEffect(() => {
        fetchClients();
    }, []);

    useEffect(() => {
        return subscribe((event) => {
            if (event.t === 'agent.online' || event.t === 'agent.offline' || event.t === 'reconnect') {
                fetchClients();
            }
        });
    }, [subscribe]);

    return { clients, loadingClients: loading };
}
