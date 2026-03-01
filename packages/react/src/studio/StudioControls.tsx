import { useState } from 'react';
import type { StudioConnectionModel } from './types';

export interface StudioControlsProps {
  connection: StudioConnectionModel;
}

export function StudioControls({ connection }: StudioControlsProps) {
  const [connectUrl, setConnectUrl] = useState('ws://localhost:3201/agent');

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        padding: 10,
        borderBottom: '1px solid #d4d4d8',
        background: '#f8fafc',
      }}
    >
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <label style={{ fontSize: 12, fontWeight: 600 }}>
          Status: {connection.status}
        </label>
        <label style={{ fontSize: 12 }}>
          Mode
          <select
            style={{ marginLeft: 6 }}
            value={connection.mode}
            onChange={(event) => connection.setMode(event.target.value as 'listen' | 'connect')}
          >
            <option value="listen">Listen</option>
            <option value="connect">Connect</option>
          </select>
        </label>

        <input
          type="text"
          value={connectUrl}
          onChange={(event) => setConnectUrl(event.target.value)}
          style={{ minWidth: 280, flex: '1 1 320px' }}
          placeholder="ws://host:port/path"
        />
        <button type="button" onClick={() => connection.connectTarget(connectUrl)}>
          Connect
        </button>
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <label style={{ fontSize: 12 }}>
          Agent
          <select
            style={{ marginLeft: 6, minWidth: 180 }}
            value={connection.selectedAgentId ?? ''}
            onChange={(event) => {
              const value = event.target.value;
              if (value) connection.selectAgent(value);
            }}
          >
            <option value="">Select agent</option>
            {connection.agents.map((agent) => (
              <option key={agent.id} value={agent.id}>
                {agent.name}
              </option>
            ))}
          </select>
        </label>

        <label style={{ fontSize: 12 }}>
          Tree
          <select
            style={{ marginLeft: 6, minWidth: 180 }}
            value={connection.selectedTreeKey ?? ''}
            onChange={(event) => {
              const value = event.target.value;
              if (value) connection.selectTree(value);
            }}
          >
            <option value="">Select tree</option>
            {connection.trees.map((tree) => (
              <option key={tree.treeKey} value={tree.treeKey}>
                {tree.name}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          onClick={() => connection.setCapture({ scope: 'tree', traceState: true })}
        >
          Trace On
        </button>
        <button
          type="button"
          onClick={() => connection.setCapture({ scope: 'tree', traceState: false })}
        >
          Trace Off
        </button>
        <button
          type="button"
          onClick={() => connection.setCapture({ scope: 'tree', profiling: true })}
        >
          Profiling On
        </button>
        <button
          type="button"
          onClick={() => connection.setCapture({ scope: 'tree', profiling: false })}
        >
          Profiling Off
        </button>
      </div>
    </div>
  );
}
