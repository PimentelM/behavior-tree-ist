import { useState, useEffect, useRef } from 'react';
import { xsalsa20poly1305 } from '@noble/ciphers/salsa';
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
    /** Payloads sent by the local UI — matching entries are excluded from the monitor. */
    selfSentPayloads: Set<string>;
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
    selfSentPayloads,
}: UseReplMonitorOptions): UseReplMonitorReturn {
    const [activities, setActivities] = useState<ReplActivityEntry[]>([]);
    const sessionKeysRef = useRef(sessionKeys);
    sessionKeysRef.current = sessionKeys;
    const selfSentPayloadsRef = useRef(selfSentPayloads);
    selfSentPayloadsRef.current = selfSentPayloads;

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

            // Skip evals that this UI instance initiated — only show external activity.
            if (selfSentPayloadsRef.current.has(encryptedRequest)) return;

            try {
                const { nonce: reqNonce, ciphertext: reqCt } = decodeEnvelope(encryptedRequest);
                let reqPlain: Uint8Array;
                try { reqPlain = xsalsa20poly1305(keys.s2c, reqNonce).decrypt(reqCt); } catch { return; }
                const req = bytesToJson<{ code: string }>(reqPlain);

                const { nonce: resNonce, ciphertext: resCt } = decodeEnvelope(encryptedResponse);
                let resPlain: Uint8Array;
                try { resPlain = xsalsa20poly1305(keys.c2s, resNonce).decrypt(resCt); } catch { return; }
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
