import { useState } from 'react';
import type { ThemeMode } from '../types';
import type { StudioConnectionModel } from './types';

export interface StudioControlsProps {
  connection: StudioConnectionModel;
  themeMode?: ThemeMode;
  showThemeToggle?: boolean;
  onToggleTheme?: () => void;
}

function getStatusClassName(status: StudioConnectionModel['status']): string {
  if (status === 'connected') return 'bt-studio-controls__status-dot--connected';
  if (status === 'connecting') return 'bt-studio-controls__status-dot--connecting';
  return 'bt-studio-controls__status-dot--disconnected';
}

export function StudioControls({
  connection,
  themeMode = 'dark',
  showThemeToggle = true,
  onToggleTheme,
}: StudioControlsProps) {
  const [connectUrl, setConnectUrl] = useState('ws://localhost:3201/agent');
  const hasAgents = connection.agents.length > 0;
  const hasTrees = connection.trees.length > 0;
  const canConnect = connectUrl.trim().length > 0;

  return (
    <div className="bt-studio-controls">
      <div className="bt-studio-controls__row">
        <div className="bt-studio-controls__status" title={`Connection status: ${connection.status}`}>
          <span className={`bt-studio-controls__status-dot ${getStatusClassName(connection.status)}`} />
          <span className="bt-studio-controls__status-label">{connection.status}</span>
        </div>
        <label className="bt-studio-controls__field bt-studio-controls__field--compact">
          <span className="bt-studio-controls__field-label">Mode</span>
          <select
            className="bt-studio-controls__select"
            value={connection.mode}
            onChange={(event) => connection.setMode(event.target.value as 'listen' | 'connect')}
          >
            <option value="listen">Listen</option>
            <option value="connect">Connect</option>
          </select>
        </label>
        <label className="bt-studio-controls__field bt-studio-controls__field--grow">
          <span className="bt-studio-controls__field-label">Connect URL</span>
          <input
            type="text"
            value={connectUrl}
            onChange={(event) => setConnectUrl(event.target.value)}
            className="bt-studio-controls__input"
            placeholder="ws://host:port/path"
          />
        </label>
        <button
          type="button"
          className="bt-studio-controls__button bt-studio-controls__button--primary"
          onClick={() => connection.connectTarget(connectUrl)}
          disabled={!canConnect}
        >
          Connect
        </button>
        {showThemeToggle && onToggleTheme && (
          <button
            type="button"
            className="bt-studio-controls__button bt-studio-controls__button--theme"
            onClick={onToggleTheme}
            aria-label={themeMode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            title={themeMode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {themeMode === 'dark' ? 'Light' : 'Dark'}
          </button>
        )}
      </div>

      <div className="bt-studio-controls__row">
        <label className="bt-studio-controls__field">
          <span className="bt-studio-controls__field-label">Agent</span>
          <select
            className="bt-studio-controls__select"
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

        <label className="bt-studio-controls__field">
          <span className="bt-studio-controls__field-label">Tree</span>
          <select
            className="bt-studio-controls__select"
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

        <div className="bt-studio-controls__group" role="group" aria-label="Capture options">
          <button
            type="button"
            className="bt-studio-controls__button"
            onClick={() => connection.setCapture({ scope: 'tree', traceState: true })}
          >
            Trace On
          </button>
          <button
            type="button"
            className="bt-studio-controls__button"
            onClick={() => connection.setCapture({ scope: 'tree', traceState: false })}
          >
            Trace Off
          </button>
          <button
            type="button"
            className="bt-studio-controls__button"
            onClick={() => connection.setCapture({ scope: 'tree', profiling: true })}
          >
            Profiling On
          </button>
          <button
            type="button"
            className="bt-studio-controls__button"
            onClick={() => connection.setCapture({ scope: 'tree', profiling: false })}
          >
            Profiling Off
          </button>
        </div>
      </div>
    </div>
  );
}
