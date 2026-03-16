import { useEffect, useState, useRef } from 'react';
import type { StudioSessionInfo } from '@bt-studio/react';
import { trpc } from '../trpc';
import type { WsSubscribe } from '../use-ui-websocket';

export function useSessions(subscribe: WsSubscribe, expandedClientId: string | null) {
    const [sessions, setSessions] = useState<StudioSessionInfo[]>([]);
    const [loading, setLoading] = useState(false);
    const currentClientIdRef = useRef(expandedClientId);
    currentClientIdRef.current = expandedClientId;

    const fetchSessions = (clientId: string) => {
        setLoading(true);
        trpc.sessions.getByClientId.query({ clientId }).then((result) => {
            if (currentClientIdRef.current !== clientId) return;
            setSessions(result.map((s) => ({
                sessionId: s.sessionId,
                clientId: s.clientId,
                startedAt: s.startedAt,
                lastSeenAt: s.lastSeenAt,
                online: s.online,
            })));
            setLoading(false);
        }).catch((err) => {
            // eslint-disable-next-line no-console
            console.log('[use-sessions] fetch error', err);
            if (currentClientIdRef.current === clientId) setLoading(false);
        });
    };

    useEffect(() => {
        if (!expandedClientId) {
            setSessions([]);
            setLoading(false);
            return;
        }
        fetchSessions(expandedClientId);
    }, [expandedClientId]);

    useEffect(() => {
        return subscribe((event) => {
            if (!currentClientIdRef.current) return;
            if (event.t === 'reconnect') {
                fetchSessions(currentClientIdRef.current);
                return;
            }
            if ((event.t === 'agent.online' || event.t === 'agent.offline') && event.clientId === currentClientIdRef.current) {
                fetchSessions(currentClientIdRef.current);
            }
        });
    }, [subscribe]);

    return { sessions, loadingSessions: loading };
}
