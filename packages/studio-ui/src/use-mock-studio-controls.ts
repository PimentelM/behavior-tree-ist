import { useState, useCallback, useMemo } from 'react';
import type {
  StudioControls,
  StudioClientInfo,
  StudioSessionInfo,
  StudioTreeInfo,
  StudioSelection,
  StudioTreeStatuses,
  StudioServerSettings,
  StudioUiSettings,
} from '@behavior-tree-ist/react';

const NOW = Date.now();

const MOCK_CLIENTS: StudioClientInfo[] = [
  { clientId: 'agent-alpha', firstSeenAt: NOW - 60_000, lastSeenAt: NOW, status: 'online' },
  { clientId: 'agent-bravo', firstSeenAt: NOW - 300_000, lastSeenAt: NOW - 120_000, status: 'offline' },
  { clientId: 'agent-charlie', firstSeenAt: NOW - 600_000, lastSeenAt: NOW - 400_000, status: 'offline' },
];

const MOCK_SESSIONS: Record<string, StudioSessionInfo[]> = {
  'agent-alpha': [
    { sessionId: 'ses-a1', clientId: 'agent-alpha', startedAt: NOW - 50_000, lastSeenAt: NOW, online: true },
    { sessionId: 'ses-a2', clientId: 'agent-alpha', startedAt: NOW - 200_000, lastSeenAt: NOW - 180_000, online: false },
  ],
  'agent-bravo': [
    { sessionId: 'ses-b1', clientId: 'agent-bravo', startedAt: NOW - 280_000, lastSeenAt: NOW - 120_000, online: false },
  ],
  'agent-charlie': [
    { sessionId: 'ses-c1', clientId: 'agent-charlie', startedAt: NOW - 550_000, lastSeenAt: NOW - 400_000, online: false },
  ],
};

const MOCK_TREES: Record<string, StudioTreeInfo[]> = {
  'ses-a1': [
    { treeId: 'patrol-tree', clientId: 'agent-alpha', sessionId: 'ses-a1', updatedAt: NOW - 2_000 },
    { treeId: 'combat-tree', clientId: 'agent-alpha', sessionId: 'ses-a1', updatedAt: NOW - 10_000 },
  ],
  'ses-a2': [
    { treeId: 'patrol-tree', clientId: 'agent-alpha', sessionId: 'ses-a2', updatedAt: NOW - 180_000 },
  ],
  'ses-b1': [
    { treeId: 'gather-tree', clientId: 'agent-bravo', sessionId: 'ses-b1', updatedAt: NOW - 130_000 },
  ],
  'ses-c1': [
    { treeId: 'idle-tree', clientId: 'agent-charlie', sessionId: 'ses-c1', updatedAt: NOW - 420_000 },
  ],
};

const DEFAULT_UI_SETTINGS: StudioUiSettings = {
  ringBufferSize: 500,
  pollRateMs: 200,
  showTreeSelectorInToolbar: false,
};

const DEFAULT_SERVER_SETTINGS: StudioServerSettings = {
  maxTicksPerTree: 1000,
};

export function useMockStudioControls(): StudioControls {
  const [selection, setSelection] = useState<StudioSelection | null>(null);
  const [expandedClientId, setExpandedClientId] = useState<string | null>(null);
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null);
  const [treeStatuses, setTreeStatuses] = useState<StudioTreeStatuses>({
    streaming: true,
    stateTrace: false,
    profiling: false,
  });
  const [serverSettings, setServerSettings] = useState<StudioServerSettings>(DEFAULT_SERVER_SETTINGS);
  const [uiSettings, setUiSettings] = useState<StudioUiSettings>(DEFAULT_UI_SETTINGS);

  const sessions = useMemo(
    () => (expandedClientId ? MOCK_SESSIONS[expandedClientId] ?? [] : []),
    [expandedClientId],
  );

  const trees = useMemo(
    () => (expandedSessionId ? MOCK_TREES[expandedSessionId] ?? [] : []),
    [expandedSessionId],
  );

  const isSelectedOnline = useMemo(() => {
    if (!selection) return false;
    const client = MOCK_CLIENTS.find((c) => c.clientId === selection.clientId);
    return client?.status === 'online';
  }, [selection]);

  const onToggleStreaming = useCallback(() => {
    setTreeStatuses((s: StudioTreeStatuses) => ({ ...s, streaming: !s.streaming }));
  }, []);

  const onToggleProfiling = useCallback(() => {
    setTreeStatuses((s: StudioTreeStatuses) => ({ ...s, profiling: !s.profiling }));
  }, []);

  const onToggleStateTrace = useCallback(() => {
    setTreeStatuses((s: StudioTreeStatuses) => ({ ...s, stateTrace: !s.stateTrace }));
  }, []);

  const onServerSettingsChange = useCallback((patch: Partial<StudioServerSettings>) => {
    setServerSettings((s: StudioServerSettings) => ({ ...s, ...patch }));
  }, []);

  const onUiSettingsChange = useCallback((patch: Partial<StudioUiSettings>) => {
    setUiSettings((s: StudioUiSettings) => ({ ...s, ...patch }));
  }, []);

  return {
    clients: MOCK_CLIENTS,
    sessions,
    trees,
    selection,
    onSelectionChange: setSelection,
    expandedClientId,
    onExpandClient: setExpandedClientId,
    expandedSessionId,
    onExpandSession: setExpandedSessionId,
    treeStatuses: selection ? treeStatuses : null,
    onToggleStreaming,
    onToggleProfiling,
    onToggleStateTrace,
    isSelectedOnline,
    serverSettings,
    uiSettings,
    onServerSettingsChange,
    onUiSettingsChange,
  };
}
