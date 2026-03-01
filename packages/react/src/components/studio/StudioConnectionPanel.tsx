import { useMemo, useState } from 'react';
import type { ThemeMode } from '../../types';
import type { StudioConnectionModel } from '../../studio/types';

interface StudioConnectionPanelProps {
  open: boolean;
  connection: StudioConnectionModel;
  showCaptureControls: boolean;
  themeMode: ThemeMode;
  onClose: () => void;
  tickWindowLimit?: number;
}

function getStatusClassName(status: StudioConnectionModel['status']): string {
  if (status === 'connected') return 'bt-studio-panel__status-dot--connected';
  if (status === 'connecting') return 'bt-studio-panel__status-dot--connecting';
  return 'bt-studio-panel__status-dot--disconnected';
}

function inferDefaultConnectUrl(): string {
  if (typeof window === 'undefined') {
    return 'ws://127.0.0.1:3210/api/agent/ws';
  }
  const host = window.location.hostname || '127.0.0.1';
  return `ws://${host}:3210/api/agent/ws`;
}

export function StudioConnectionPanel({
  open,
  connection,
  showCaptureControls,
  themeMode,
  onClose,
  tickWindowLimit,
}: StudioConnectionPanelProps) {
  const [connectUrl, setConnectUrl] = useState(inferDefaultConnectUrl);
  const hasAgents = connection.agents.length > 0;
  const hasTrees = connection.trees.length > 0;
  const canConnect = connectUrl.trim().length > 0;

  const selectedAgentName = useMemo(() => {
    if (!connection.selectedAgentId) return null;
    return connection.agents.find((agent) => agent.id === connection.selectedAgentId)?.name ?? null;
  }, [connection.agents, connection.selectedAgentId]);

  if (!open) {
    return null;
  }

  return (
    <div className={`bt-studio-panel bt-debugger--${themeMode}`} role="dialog" aria-label="Studio connections">
      <div className="bt-studio-panel__header">
        <div className="bt-studio-panel__title">Connections</div>
        <button
          type="button"
          className="bt-studio-panel__close"
          onClick={onClose}
          aria-label="Close connections panel"
          title="Close connections panel"
        >
          ×
        </button>
      </div>

      <div className="bt-studio-panel__section">
        <div className="bt-studio-panel__status" title={`Connection status: ${connection.status}`}>
          <span className={`bt-studio-panel__status-dot ${getStatusClassName(connection.status)}`} />
          <span className="bt-studio-panel__status-label">{connection.status}</span>
        </div>
        <button
          type="button"
          className="bt-studio-panel__button"
          onClick={connection.retryNow}
        >
          Retry
        </button>
      </div>

      <div className="bt-studio-panel__section bt-studio-panel__section--stack">
        <label className="bt-studio-panel__field">
          <span className="bt-studio-panel__field-label">Mode</span>
          <select
            className="bt-studio-panel__select"
            value={connection.mode}
            onChange={(event) => connection.setMode(event.target.value as 'listen' | 'connect')}
          >
            <option value="listen">Listen</option>
            <option value="connect">Connect</option>
          </select>
        </label>

        <label className="bt-studio-panel__field">
          <span className="bt-studio-panel__field-label">Connect URL</span>
          <div className="bt-studio-panel__inline">
            <input
              type="text"
              value={connectUrl}
              onChange={(event) => setConnectUrl(event.target.value)}
              className="bt-studio-panel__input"
              placeholder="ws://host:port/path"
            />
            <button
              type="button"
              className="bt-studio-panel__button bt-studio-panel__button--primary"
              onClick={() => connection.connectTarget(connectUrl)}
              disabled={!canConnect}
            >
              Connect
            </button>
          </div>
        </label>
      </div>

      <div className="bt-studio-panel__section bt-studio-panel__section--stack">
        <label className="bt-studio-panel__field">
          <span className="bt-studio-panel__field-label">Attach to agent</span>
          <select
            className="bt-studio-panel__select"
            value={connection.selectedAgentId ?? ''}
            onChange={(event) => {
              const value = event.target.value;
              if (value) connection.selectAgent(value);
            }}
            disabled={!hasAgents}
          >
            <option value="">{hasAgents ? 'Select agent' : 'No agents'}</option>
            {connection.agents.map((agent) => (
              <option key={agent.id} value={agent.id}>
                {agent.name}
              </option>
            ))}
          </select>
        </label>

        <div className="bt-studio-panel__inline bt-studio-panel__inline--between">
          <span className="bt-studio-panel__attached-label">
            {selectedAgentName ? `Attached: ${selectedAgentName}` : 'Not attached'}
          </span>
          <button
            type="button"
            className="bt-studio-panel__button"
            onClick={connection.detachAgent}
            disabled={!connection.selectedAgentId}
          >
            Detach
          </button>
        </div>

        <label className="bt-studio-panel__field">
          <span className="bt-studio-panel__field-label">Tree</span>
          <select
            className="bt-studio-panel__select"
            value={connection.selectedTreeKey ?? ''}
            onChange={(event) => {
              const value = event.target.value;
              if (value) connection.selectTree(value);
            }}
            disabled={!hasTrees}
          >
            <option value="">{hasTrees ? 'Select tree' : 'No trees'}</option>
            {connection.trees.map((tree) => (
              <option key={tree.treeKey} value={tree.treeKey}>
                {tree.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {showCaptureControls && (
        <div className="bt-studio-panel__section bt-studio-panel__section--stack">
          <div className="bt-studio-panel__field-label">Capture</div>
          <div className="bt-studio-panel__group" role="group" aria-label="Capture options">
            <button
              type="button"
              className="bt-studio-panel__button"
              onClick={() => connection.setCapture({ scope: 'tree', traceState: true })}
            >
              Trace On
            </button>
            <button
              type="button"
              className="bt-studio-panel__button"
              onClick={() => connection.setCapture({ scope: 'tree', traceState: false })}
            >
              Trace Off
            </button>
            <button
              type="button"
              className="bt-studio-panel__button"
              onClick={() => connection.setCapture({ scope: 'tree', profiling: true })}
            >
              Profiling On
            </button>
            <button
              type="button"
              className="bt-studio-panel__button"
              onClick={() => connection.setCapture({ scope: 'tree', profiling: false })}
            >
              Profiling Off
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
