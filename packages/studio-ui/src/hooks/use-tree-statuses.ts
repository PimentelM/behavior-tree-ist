import { useEffect, useState, useRef, useCallback } from 'react';
import { StudioCommandType } from '@bt-studio/core';
import type { StudioSelection, StudioTreeStatuses } from '@bt-studio/react';
import { trpc } from '../trpc';

export function useTreeStatuses(selection: StudioSelection | null, isOnline: boolean) {
    const [treeStatuses, setTreeStatuses] = useState<StudioTreeStatuses | null>(null);
    const selectionRef = useRef(selection);
    selectionRef.current = selection;

    const fetchStatuses = useCallback(() => {
        const sel = selectionRef.current;
        if (!sel) return;

        trpc.commands.send.mutate({
            clientId: sel.clientId,
            sessionId: sel.sessionId,
            treeId: sel.treeId,
            command: StudioCommandType.GetTreeStatuses,
        }).then((response) => {
            if (selectionRef.current !== sel) return;
            if (response.success && 'data' in response) {
                setTreeStatuses({
                    streaming: response.data.streaming,
                    stateTrace: response.data.stateTrace,
                    profiling: response.data.profiling,
                });
            }
        }).catch((_err: unknown) => {
            // eslint-disable-next-line no-console
            console.error('[use-tree-statuses] fetch error', _err);
        });
    }, []);

    useEffect(() => {
        if (!selection) {
            setTreeStatuses(null);
            return;
        }
        if (!isOnline) {
            setTreeStatuses(null);
            return;
        }
        fetchStatuses();
    }, [selection?.clientId, selection?.sessionId, selection?.treeId, isOnline]);

    const sendToggle = useCallback((enableCmd: number, disableCmd: number, currentValue: boolean) => {
        const sel = selectionRef.current;
        if (!sel) return;

        trpc.commands.send.mutate({
            clientId: sel.clientId,
            sessionId: sel.sessionId,
            treeId: sel.treeId,
            command: currentValue ? disableCmd : enableCmd,
        }).then(() => {
            fetchStatuses();
        }).catch((_err: unknown) => {
            // eslint-disable-next-line no-console
            console.error('[use-tree-statuses] toggle error', _err);
        });
    }, [fetchStatuses]);

    const onToggleStreaming = useCallback(() => {
        if (!treeStatuses) return;
        sendToggle(StudioCommandType.EnableStreaming, StudioCommandType.DisableStreaming, treeStatuses.streaming);
    }, [treeStatuses, sendToggle]);

    const onToggleProfiling = useCallback(() => {
        if (!treeStatuses) return;
        sendToggle(StudioCommandType.EnableProfiling, StudioCommandType.DisableProfiling, treeStatuses.profiling);
    }, [treeStatuses, sendToggle]);

    const onToggleStateTrace = useCallback(() => {
        if (!treeStatuses) return;
        sendToggle(StudioCommandType.EnableStateTrace, StudioCommandType.DisableStateTrace, treeStatuses.stateTrace);
    }, [treeStatuses, sendToggle]);

    return { treeStatuses, onToggleStreaming, onToggleProfiling, onToggleStateTrace };
}
