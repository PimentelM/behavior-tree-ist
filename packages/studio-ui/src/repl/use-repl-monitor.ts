import { useState, useEffect, useRef } from 'react';
import nacl from 'tweetnacl';
import { decodeEnvelope, bytesToJson } from './use-repl';
import type { ReplResult } from './use-repl';
import type { WsSubscribe, WsEvent } from '../use-ui-websocket';

export interface ReplActivityEntry {
    code: string;
    result: ReplResult;
    timestamp: number;
}

export interface UseReplMonitorOptions {
    clientId: string | null;
    sessionId: string | null;
    sessionKeys: { c2s: Uint8Array; s2c: Uint8Array } | null;
    subscribe: WsSubscribe;
}

export interface UseReplMonitorReturn {
    activities: ReplActivityEntry[];
    clearActivities: () => void;
}

export function useReplMonitor({
    subscribe,
    clientId,
    sessionId,
    sessionKeys,
}: UseReplMonitorOptions): UseReplMonitorReturn {
    const [activities, setActivities] = useState<ReplActivityEntry[]>([]);
    const sessionKeysRef = useRef(sessionKeys);
    sessionKeysRef.current = sessionKeys;

    useEffect(() => {
        if (!clientId || !sessionId) return;
        return subscribe((event: WsEvent) => {
            // Cast to Record to check the 't' field without TypeScript narrowing errors
            // ('repl.activity' is not yet in UiMessageType until protocol T1 is merged)
            const rawEvent = event as Record<string, unknown>;
            if (rawEvent['t'] !== 'repl.activity') return;
            if (rawEvent['clientId'] !== clientId || rawEvent['sessionId'] !== sessionId) return;

            const keys = sessionKeysRef.current;
            if (!keys) return;

            const encryptedRequest = rawEvent['encryptedRequest'];
            const encryptedResponse = rawEvent['encryptedResponse'];
            const timestamp = rawEvent['timestamp'];
            if (
                typeof encryptedRequest !== 'string' ||
                typeof encryptedResponse !== 'string' ||
                typeof timestamp !== 'number'
            ) return;

            try {
                const { nonce: reqNonce, ciphertext: reqCt } = decodeEnvelope(encryptedRequest);
                const reqPlain = nacl.secretbox.open(reqCt, reqNonce, keys.s2c);
                if (!reqPlain) return;
                const req = bytesToJson<{ code: string }>(reqPlain);

                const { nonce: resNonce, ciphertext: resCt } = decodeEnvelope(encryptedResponse);
                const resPlain = nacl.secretbox.open(resCt, resNonce, keys.c2s);
                if (!resPlain) return;
                const res = bytesToJson<ReplResult>(resPlain);

                setActivities((prev) => [...prev, { code: req.code, result: res, timestamp }]);
            } catch {
                // silently drop undecryptable entries (wrong keys, wrong session)
            }
        });
    }, [clientId, sessionId, subscribe]);

    return {
        activities,
        clearActivities: () => { setActivities([]); },
    };
}
