import { useState, useEffect, useCallback, useRef } from 'react';
import type { TickRecord } from '@behavior-tree-ist/core';
import type { StudioClient, StudioTreeInfo } from '@behavior-tree-ist/react';
import { trpc } from '../trpc-client';
import type { StoredTree, ServerSettings } from '../../server/domain/types';

export interface UseStudioPollingOptions {
    intervalMs?: number;
    tickFetchLimit?: number;
}

export interface UseStudioPollingResult {
    clients: StudioClient[];
    trees: StudioTreeInfo[];
    rawTree: StoredTree | null;
    ticks: TickRecord[];
    serverSettings: ServerSettings | null;
    error: Error | null;
}

export function useStudioPolling(
    selectedClientId: string | null,
    selectedTreeId: string | null,
    options: UseStudioPollingOptions = {}
): UseStudioPollingResult {
    const intervalMs = options.intervalMs ?? 500;
    const tickFetchLimit = options.tickFetchLimit ?? 200;

    const [clients, setClients] = useState<StudioClient[]>([]);
    const [trees, setTrees] = useState<StudioTreeInfo[]>([]);
    const [rawTree, setRawTree] = useState<StoredTree | null>(null);
    const [ticks, setTicks] = useState<TickRecord[]>([]);
    const [serverSettings, setServerSettings] = useState<ServerSettings | null>(null);
    const [error, setError] = useState<Error | null>(null);

    const prevSelectionRef = useRef({ selectedClientId, selectedTreeId });
    const afterTickIdRef = useRef<number | undefined>(undefined);

    // Reset ticks when selection changes
    useEffect(() => {
        const prev = prevSelectionRef.current;
        if (
            prev.selectedClientId !== selectedClientId ||
            prev.selectedTreeId !== selectedTreeId
        ) {
            setTicks([]);
            setRawTree(null);
            afterTickIdRef.current = undefined;
            prevSelectionRef.current = { selectedClientId, selectedTreeId };
        }
    }, [selectedClientId, selectedTreeId]);

    const poll = useCallback(async () => {
        try {
            // 1. Fetch settings (could be cached, but polled here for simplicity)
            const settingsResult = await trpc.getSettings.query();
            setServerSettings(settingsResult);

            // 2. Fetch clients
            const clientsResult = await trpc.getClients.query();
            setClients(clientsResult.map(c => ({
                clientId: c.clientId,
                isOnline: c.isOnline,
            })));

            // 3. Fetch trees for selected client
            if (selectedClientId) {
                const treesResult = await trpc.getTrees.query({ clientId: selectedClientId });
                setTrees(treesResult.map(t => ({
                    treeId: t.treeId,
                })));
            } else {
                setTrees([]);
            }

            // 4. Fetch tree and ticks if tree selected
            if (selectedClientId && selectedTreeId) {
                // Fetch raw tree if not already fetched
                if (!rawTree || rawTree.treeId !== selectedTreeId) {
                    const treeResult = await trpc.getTree.query({ clientId: selectedClientId, treeId: selectedTreeId });
                    setRawTree((treeResult as unknown as StoredTree) ?? null);
                }

                // Fetch ticks incrementally
                const ticksResult = await trpc.getTicks.query({
                    clientId: selectedClientId,
                    treeId: selectedTreeId,
                    afterTickId: afterTickIdRef.current,
                    limit: tickFetchLimit,
                });

                const newTicks = ticksResult as unknown as TickRecord[];

                if (newTicks.length > 0) {
                    setTicks(prev => [...prev, ...newTicks]);
                    afterTickIdRef.current = newTicks[newTicks.length - 1]?.tickId;
                }
            }

            setError(null);
        } catch (e) {
            setError(e instanceof Error ? e : new Error('Unknown polling error'));
        }
    }, [selectedClientId, selectedTreeId, tickFetchLimit, rawTree]);

    // Polling loop
    useEffect(() => {
        poll(); // Run immediately
        const intervalId = setInterval(poll, intervalMs);
        return () => clearInterval(intervalId);
    }, [poll, intervalMs]);

    return { clients, trees, rawTree, ticks, serverSettings, error };
}
