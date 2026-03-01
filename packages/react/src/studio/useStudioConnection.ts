import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { SerializableNode, TickRecord } from '@behavior-tree-ist/core';
import type {
  StudioAgentSummary,
  StudioChannelMode,
  StudioConnectionModel,
  StudioConnectionStatus,
  StudioTreeSummary,
} from './types';

type UiRequestMethod =
  | 'ui.getSessionState'
  | 'ui.configureChannel'
  | 'ui.selectAgent'
  | 'ui.selectTree'
  | 'ui.setCapture'
  | 'ui.heartbeat'
  | 'ui.detachAgent';

type UiEventName =
  | 'ui.sessionState'
  | 'ui.agentListChanged'
  | 'ui.treeListChanged'
  | 'ui.treeSnapshot'
  | 'ui.tickBatch'
  | 'ui.warning';

type UiFrame =
  | { v: 1; kind: 'req'; id: string; method: UiRequestMethod; params?: unknown }
  | { v: 1; kind: 'res'; id: string; ok: true; result?: unknown }
  | { v: 1; kind: 'res'; id: string; ok: false; error: { code: string; message: string } }
  | { v: 1; kind: 'evt'; event: UiEventName; data?: unknown };

interface UseStudioConnectionOptions {
  serverUrl?: string;
  wsPath?: string;
  maxLocalTicks?: number;
  heartbeatMs?: number;
  reconnectInitialMs?: number;
  reconnectMaxMs?: number;
  reconnectFactor?: number;
  reconnectJitterRatio?: number;
}

type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
};

const DEFAULT_MAX_LOCAL_TICKS = 5000;

function toWsUrl(serverUrl: string, wsPath: string): string {
  const base = new URL(serverUrl);
  base.protocol = base.protocol === 'https:' ? 'wss:' : 'ws:';
  base.pathname = wsPath;
  base.search = '';
  base.hash = '';
  return base.toString();
}

function parseFrame(raw: string): UiFrame | undefined {
  try {
    return JSON.parse(raw) as UiFrame;
  } catch {
    return undefined;
  }
}

export function useStudioConnection(options: UseStudioConnectionOptions = {}): StudioConnectionModel {
  const serverUrl = options.serverUrl ?? (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000');
  const wsPath = options.wsPath ?? '/api/ui/ws';
  const wsUrl = toWsUrl(serverUrl, wsPath);
  const maxLocalTicks = options.maxLocalTicks ?? DEFAULT_MAX_LOCAL_TICKS;
  const heartbeatMs = options.heartbeatMs ?? 3000;
  const reconnectInitialMs = Math.max(50, Math.floor(options.reconnectInitialMs ?? 250));
  const reconnectMaxMs = Math.max(reconnectInitialMs, Math.floor(options.reconnectMaxMs ?? 5000));
  const reconnectFactor = Math.max(1.2, options.reconnectFactor ?? 2);
  const reconnectJitterRatio = Math.min(1, Math.max(0, options.reconnectJitterRatio ?? 0.2));

  const wsRef = useRef<WebSocket | null>(null);
  const pendingRef = useRef(new Map<string, PendingRequest>());
  const requestSeqRef = useRef(1);
  const heartbeatTimerRef = useRef<number | undefined>(undefined);
  const reconnectTimerRef = useRef<number | undefined>(undefined);
  const reconnectBackoffMsRef = useRef(reconnectInitialMs);
  const disposedRef = useRef(false);
  const selectedTreeKeyRef = useRef<string | null>(null);
  const wsUrlRef = useRef(wsUrl);
  const lastWsUrlRef = useRef(wsUrl);

  const [status, setStatus] = useState<StudioConnectionStatus>('disconnected');
  const [mode, setModeState] = useState<StudioChannelMode>('listen');
  const [agents, setAgents] = useState<StudioAgentSummary[]>([]);
  const [trees, setTrees] = useState<StudioTreeSummary[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [selectedTreeKey, setSelectedTreeKey] = useState<string | null>(null);
  const [tree, setTree] = useState<SerializableNode | null>(null);
  const [ticks, setTicks] = useState<TickRecord[]>([]);

  useEffect(() => {
    selectedTreeKeyRef.current = selectedTreeKey;
  }, [selectedTreeKey]);

  useEffect(() => {
    wsUrlRef.current = wsUrl;
  }, [wsUrl]);

  const clearHeartbeatTimer = useCallback(() => {
    if (heartbeatTimerRef.current !== undefined) {
      window.clearTimeout(heartbeatTimerRef.current);
      heartbeatTimerRef.current = undefined;
    }
  }, []);

  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimerRef.current !== undefined) {
      window.clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = undefined;
    }
  }, []);

  const rejectPending = useCallback((message: string) => {
    for (const pending of pendingRef.current.values()) {
      pending.reject(new Error(message));
    }
    pendingRef.current.clear();
  }, []);

  const sendFrame = useCallback((frame: UiFrame): boolean => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      return false;
    }
    ws.send(JSON.stringify(frame));
    return true;
  }, []);

  const sendRequest = useCallback((method: UiRequestMethod, params?: unknown): Promise<unknown> => {
    const id = String(requestSeqRef.current++);
    const sent = sendFrame({ v: 1, kind: 'req', id, method, params });
    if (!sent) {
      return Promise.reject(new Error(`Studio connection is not open: ${method}`));
    }

    return new Promise((resolve, reject) => {
      pendingRef.current.set(id, { resolve, reject });
      window.setTimeout(() => {
        const pending = pendingRef.current.get(id);
        if (!pending) return;
        pendingRef.current.delete(id);
        reject(new Error(`Studio request timed out: ${method}`));
      }, 5000);
    });
  }, [sendFrame]);

  const handleSessionState = useCallback((data: unknown) => {
    if (!data || typeof data !== 'object') return;
    const payload = data as {
      mode?: StudioChannelMode;
      selectedAgentId?: string | null;
      selectedTreeKey?: string | null;
      agents?: StudioAgentSummary[];
      trees?: StudioTreeSummary[];
      lastSnapshot?: SerializableNode;
      bufferedTicks?: TickRecord[];
    };

    if (payload.mode === 'listen' || payload.mode === 'connect') {
      setModeState(payload.mode);
    }
    if (Array.isArray(payload.agents)) {
      setAgents(payload.agents);
    }
    if (Array.isArray(payload.trees)) {
      setTrees(payload.trees);
    }
    setSelectedAgentId(payload.selectedAgentId ?? null);
    setSelectedTreeKey(payload.selectedTreeKey ?? null);
    setTree(payload.lastSnapshot ?? null);
    if (Array.isArray(payload.bufferedTicks)) {
      setTicks(payload.bufferedTicks.slice(-maxLocalTicks));
    }
  }, [maxLocalTicks]);

  const scheduleHeartbeat = useCallback(() => {
    clearHeartbeatTimer();

    const fire = () => {
      if (disposedRef.current || wsRef.current?.readyState !== WebSocket.OPEN) {
        return;
      }
      sendRequest('ui.heartbeat').catch(() => undefined);
      heartbeatTimerRef.current = window.setTimeout(fire, heartbeatMs);
    };

    heartbeatTimerRef.current = window.setTimeout(fire, heartbeatMs);
  }, [clearHeartbeatTimer, heartbeatMs, sendRequest]);

  const scheduleReconnect = useCallback((immediate = false) => {
    if (disposedRef.current) {
      return;
    }

    clearReconnectTimer();
    const startConnect = () => {
      reconnectTimerRef.current = undefined;
      const current = wsRef.current;
      if (current && (current.readyState === WebSocket.OPEN || current.readyState === WebSocket.CONNECTING)) {
        return;
      }

      setStatus('connecting');
      const ws = new WebSocket(wsUrlRef.current);
      wsRef.current = ws;

      ws.onopen = () => {
        if (wsRef.current !== ws || disposedRef.current) {
          ws.close();
          return;
        }

        reconnectBackoffMsRef.current = reconnectInitialMs;
        setStatus('connected');
        sendRequest('ui.getSessionState').catch(() => undefined);
        scheduleHeartbeat();
      };

      ws.onclose = () => {
        if (wsRef.current !== ws) {
          return;
        }

        wsRef.current = null;
        clearHeartbeatTimer();
        rejectPending('Studio connection closed');
        setStatus('disconnected');

        reconnectBackoffMsRef.current = Math.min(
          reconnectMaxMs,
          Math.max(reconnectInitialMs, reconnectBackoffMsRef.current * reconnectFactor),
        );
        scheduleReconnect(false);
      };

      ws.onerror = () => {
        if (wsRef.current !== ws) {
          return;
        }
        setStatus('disconnected');
      };

      ws.onmessage = (event) => {
        if (wsRef.current !== ws) {
          return;
        }
        if (typeof event.data !== 'string') {
          return;
        }

        const frame = parseFrame(event.data);
        if (!frame) {
          return;
        }

        if (frame.kind === 'res') {
          const pending = pendingRef.current.get(frame.id);
          if (!pending) return;
          pendingRef.current.delete(frame.id);
          if (frame.ok) {
            pending.resolve(frame.result);
          } else {
            pending.reject(new Error(frame.error.message));
          }
          return;
        }

        if (frame.kind !== 'evt') {
          return;
        }

        switch (frame.event) {
          case 'ui.sessionState':
            handleSessionState(frame.data);
            break;
          case 'ui.agentListChanged':
            if (frame.data && typeof frame.data === 'object' && Array.isArray((frame.data as { agents?: unknown[] }).agents)) {
              setAgents((frame.data as { agents: StudioAgentSummary[] }).agents);
            }
            break;
          case 'ui.treeListChanged':
            if (frame.data && typeof frame.data === 'object' && Array.isArray((frame.data as { trees?: unknown[] }).trees)) {
              setTrees((frame.data as { trees: StudioTreeSummary[] }).trees);
            }
            break;
          case 'ui.treeSnapshot':
            if (frame.data && typeof frame.data === 'object') {
              const payload = frame.data as { tree?: SerializableNode | null };
              setTree(payload.tree ?? null);
              setTicks([]);
            }
            break;
          case 'ui.tickBatch':
            if (frame.data && typeof frame.data === 'object') {
              const payload = frame.data as { treeKey?: string; ticks?: TickRecord[] };
              if (!Array.isArray(payload.ticks)) return;
              const batchTicks = payload.ticks;
              const selectedTree = selectedTreeKeyRef.current;
              if (selectedTree && payload.treeKey && payload.treeKey !== selectedTree) return;
              setTicks((prev) => {
                const merged = [...prev, ...batchTicks];
                if (merged.length <= maxLocalTicks) {
                  return merged;
                }
                return merged.slice(merged.length - maxLocalTicks);
              });
            }
            break;
          case 'ui.warning':
            if (frame.data && typeof frame.data === 'object') {
              const payload = frame.data as { message?: string };
              if (payload.message) {
                console.warn(`[studio] ${payload.message}`);
              }
            }
            break;
        }
      };
    };

    if (immediate) {
      startConnect();
      return;
    }

    const baseDelay = reconnectBackoffMsRef.current;
    const jitterRange = baseDelay * reconnectJitterRatio;
    const jitter = jitterRange > 0 ? (Math.random() * jitterRange * 2) - jitterRange : 0;
    const delayMs = Math.max(0, Math.floor(baseDelay + jitter));
    reconnectTimerRef.current = window.setTimeout(startConnect, delayMs);
  }, [
    clearHeartbeatTimer,
    clearReconnectTimer,
    handleSessionState,
    heartbeatMs,
    maxLocalTicks,
    reconnectFactor,
    reconnectInitialMs,
    reconnectJitterRatio,
    reconnectMaxMs,
    rejectPending,
    scheduleHeartbeat,
    sendRequest,
  ]);

  useEffect(() => {
    disposedRef.current = false;
    reconnectBackoffMsRef.current = reconnectInitialMs;
    setStatus('connecting');
    scheduleReconnect(true);

    return () => {
      disposedRef.current = true;
      clearHeartbeatTimer();
      clearReconnectTimer();

      const ws = wsRef.current;
      wsRef.current = null;
      ws?.close();

      rejectPending('Studio connection closed');
      setStatus('disconnected');
    };
  }, [clearHeartbeatTimer, clearReconnectTimer, reconnectInitialMs, rejectPending, scheduleReconnect]);

  useEffect(() => {
    if (lastWsUrlRef.current === wsUrl) {
      return;
    }

    lastWsUrlRef.current = wsUrl;
    wsUrlRef.current = wsUrl;
    clearHeartbeatTimer();
    clearReconnectTimer();
    rejectPending('Studio connection endpoint changed');

    const ws = wsRef.current;
    wsRef.current = null;
    ws?.close();

    reconnectBackoffMsRef.current = reconnectInitialMs;
    setStatus('connecting');
    scheduleReconnect(true);
  }, [clearHeartbeatTimer, clearReconnectTimer, reconnectInitialMs, rejectPending, scheduleReconnect, wsUrl]);

  const refreshSessionState = useCallback(() => {
    sendRequest('ui.getSessionState').catch(() => undefined);
  }, [sendRequest]);

  const setMode = useCallback((nextMode: StudioChannelMode) => {
    setModeState(nextMode);
    sendRequest('ui.configureChannel', { mode: nextMode })
      .then(() => refreshSessionState())
      .catch(() => undefined);
  }, [refreshSessionState, sendRequest]);

  const connectTarget = useCallback((url: string) => {
    sendRequest('ui.configureChannel', { mode: 'connect', connect: { url } })
      .then(() => refreshSessionState())
      .catch(() => undefined);
  }, [refreshSessionState, sendRequest]);

  const selectAgent = useCallback((agentId: string) => {
    setSelectedAgentId(agentId);
    setTree(null);
    setTicks([]);
    sendRequest('ui.selectAgent', { agentId })
      .then(() => refreshSessionState())
      .catch(() => undefined);
  }, [refreshSessionState, sendRequest]);

  const detachAgent = useCallback(() => {
    setSelectedAgentId(null);
    setSelectedTreeKey(null);
    setTrees([]);
    setTree(null);
    setTicks([]);
    sendRequest('ui.detachAgent')
      .then(() => refreshSessionState())
      .catch(() => undefined);
  }, [refreshSessionState, sendRequest]);

  const retryNow = useCallback(() => {
    if (status === 'connected') {
      refreshSessionState();
      return;
    }
    scheduleReconnect(true);
  }, [refreshSessionState, scheduleReconnect, status]);

  const selectTree = useCallback((treeKey: string) => {
    setSelectedTreeKey(treeKey);
    setTicks([]);
    sendRequest('ui.selectTree', { treeKey })
      .then(() => refreshSessionState())
      .catch(() => undefined);
  }, [refreshSessionState, sendRequest]);

  const setCapture = useCallback((params: { scope: 'tree' | 'all'; traceState?: boolean; profiling?: boolean }) => {
    sendRequest('ui.setCapture', params).catch(() => undefined);
  }, [sendRequest]);

  return useMemo(() => ({
    status,
    mode,
    agents,
    trees,
    selectedAgentId,
    selectedTreeKey,
    tree,
    ticks,
    setMode,
    connectTarget,
    selectAgent,
    detachAgent,
    retryNow,
    selectTree,
    setCapture,
  }), [
    agents,
    connectTarget,
    detachAgent,
    mode,
    retryNow,
    selectAgent,
    selectTree,
    selectedAgentId,
    selectedTreeKey,
    setCapture,
    setMode,
    status,
    ticks,
    tree,
    trees,
  ]);
}
