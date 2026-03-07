import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import type { SerializableNode, TickRecord } from '@bt-studio/core';
import type { StudioControls, StudioSelection } from '@bt-studio/react';
import { useUiWebSocket } from './use-ui-websocket';
import { useClients } from './hooks/use-clients';
import { useSessions } from './hooks/use-sessions';
import { useTrees } from './hooks/use-trees';
import { useSelectedTree } from './hooks/use-selected-tree';
import { useTreeStatuses } from './hooks/use-tree-statuses';
import { useTickPoller } from './hooks/use-tick-poller';
import { useServerSettings } from './hooks/use-server-settings';
import { useUiSettings } from './hooks/use-ui-settings';

const SELECTION_KEY = 'bt-studio-selection';

function loadSelection(): { selection: StudioSelection | null; expandedClientId: string | null; expandedSessionId: string | null } {
    try {
        const raw = sessionStorage.getItem(SELECTION_KEY);
        if (raw) {
            const sel = JSON.parse(raw) as StudioSelection;
            return { selection: sel, expandedClientId: sel.clientId, expandedSessionId: sel.sessionId };
        }
    } catch { /* ignore */ }
    return { selection: null, expandedClientId: null, expandedSessionId: null };
}

function saveSelection(selection: StudioSelection | null) {
    try {
        if (selection) {
            sessionStorage.setItem(SELECTION_KEY, JSON.stringify(selection));
        } else {
            sessionStorage.removeItem(SELECTION_KEY);
        }
    } catch { /* ignore */ }
}

export interface UseStudioControlsResult {
    studioControls: StudioControls;
    tree: SerializableNode | null;
    ticks: TickRecord[];
}

export function useStudioControls(): UseStudioControlsResult {
    const initialState = useMemo(loadSelection, []);
    const [selection, setSelectionRaw] = useState<StudioSelection | null>(initialState.selection);
    const [expandedClientId, setExpandedClientId] = useState<string | null>(initialState.expandedClientId);
    const [expandedSessionId, setExpandedSessionId] = useState<string | null>(initialState.expandedSessionId);

    const subscribe = useUiWebSocket();
    const { clients, loadingClients } = useClients(subscribe);
    const { sessions, loadingSessions } = useSessions(subscribe, expandedClientId);
    const { trees, loadingTrees } = useTrees(subscribe, expandedClientId, expandedSessionId);
    const tree = useSelectedTree(selection);
    const { uiSettings, onUiSettingsChange } = useUiSettings();
    const { serverSettings, onServerSettingsChange } = useServerSettings();

    const isSelectedOnline = useMemo(() => {
        if (!selection) return false;
        const client = clients.find((c) => c.clientId === selection.clientId);
        return client?.status === 'online';
    }, [clients, selection]);

    const { treeStatuses, onToggleStreaming, onToggleProfiling, onToggleStateTrace } = useTreeStatuses(selection, isSelectedOnline);

    const streaming = treeStatuses?.streaming ?? false;
    const ticks = useTickPoller(selection, uiSettings.pollRateMs, uiSettings.ringBufferSize, streaming);

    // Selection persistence
    const onSelectionChange = useCallback((sel: StudioSelection | null) => {
        setSelectionRaw(sel);
        saveSelection(sel);
        if (sel) {
            setExpandedClientId(sel.clientId);
            setExpandedSessionId(sel.sessionId);
        }
    }, []);

    // Clear stale persisted selection
    const validationDone = useRef(false);
    useEffect(() => {
        if (validationDone.current || loadingClients || !selection) return;
        validationDone.current = true;

        const clientExists = clients.some((c) => c.clientId === selection.clientId);
        if (!clientExists && clients.length > 0) {
            onSelectionChange(null);
        }
    }, [clients, loadingClients, selection, onSelectionChange]);

    const studioControls: StudioControls = useMemo(() => ({
        clients,
        sessions,
        trees,
        selection,
        onSelectionChange,
        expandedClientId,
        onExpandClient: setExpandedClientId,
        expandedSessionId,
        onExpandSession: setExpandedSessionId,
        treeStatuses,
        onToggleStreaming,
        onToggleProfiling,
        onToggleStateTrace,
        isSelectedOnline,
        serverSettings,
        uiSettings,
        onServerSettingsChange,
        onUiSettingsChange,
        loadingClients,
        loadingSessions,
        loadingTrees,
    }), [
        clients, sessions, trees, selection, onSelectionChange,
        expandedClientId, expandedSessionId,
        treeStatuses, onToggleStreaming, onToggleProfiling, onToggleStateTrace,
        isSelectedOnline, serverSettings, uiSettings, onServerSettingsChange, onUiSettingsChange,
        loadingClients, loadingSessions, loadingTrees,
    ]);

    return { studioControls, tree, ticks };
}
