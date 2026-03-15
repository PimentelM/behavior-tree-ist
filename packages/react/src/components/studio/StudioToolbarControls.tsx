import type { ReactNode } from 'react';
import type { StudioControls, StudioSelection } from '../../types';
import { AttachIcon, StreamIcon, PauseIcon, ProfilingIcon, TraceIcon, SettingsIcon } from './icons';
import { ByteMetricsBadge } from '../panels/ByteMetricsBadge';

interface StudioToolbarFragments {
  leading: ReactNode;
  trailing: ReactNode;
  connectionBadge: ReactNode;
}

function selectionSummary(selection: StudioSelection | null): string {
  if (!selection) return 'Attach';
  return selection.treeId;
}

function connectionLabel(controls: StudioControls): { label: string; variant: string } | null {
  if (!controls.selection) return null;
  if (!controls.isSelectedOnline) return { label: 'Historical', variant: 'historical' };
  if (controls.treeStatuses?.streaming) return { label: 'Connected', variant: 'connected' };
  return { label: 'Paused', variant: 'paused-stream' };
}

export function buildStudioToolbarFragments(
  controls: StudioControls,
  onOpenAttach: () => void,
  onOpenSettings: () => void,
): StudioToolbarFragments {
  const offline = !controls.isSelectedOnline;
  const statuses = controls.treeStatuses;
  const toggleDisabled = offline || !statuses;
  const conn = connectionLabel(controls);

  return {
    leading: (
      <div className="bt-toolbar__studio-group">
        <button
          type="button"
          className="bt-toolbar__studio-attach-btn"
          onClick={onOpenAttach}
          title="Select client / session / tree"
        >
          <AttachIcon />
          <span className="bt-toolbar__studio-attach-label">{selectionSummary(controls.selection)}</span>
          <span className="bt-toolbar__studio-attach-caret" aria-hidden="true">&#9662;</span>
        </button>

        <button
          type="button"
          className={`bt-toolbar__studio-toggle ${statuses?.streaming ? 'bt-toolbar__studio-toggle--active' : ''} ${toggleDisabled ? 'bt-toolbar__studio-toggle--disabled' : ''}`}
          onClick={controls.onToggleStreaming}
          disabled={toggleDisabled}
          aria-label={statuses?.streaming ? 'Pause streaming' : 'Start streaming'}
          title={toggleDisabled ? 'Select an online tree first' : statuses?.streaming ? 'Pause streaming' : 'Start streaming'}
        >
          {statuses?.streaming ? <PauseIcon /> : <StreamIcon />}
          <span className="bt-toolbar__studio-toggle-label">Stream</span>
        </button>

        <button
          type="button"
          className={`bt-toolbar__studio-toggle ${statuses?.profiling ? 'bt-toolbar__studio-toggle--active' : ''} ${toggleDisabled ? 'bt-toolbar__studio-toggle--disabled' : ''}`}
          onClick={controls.onToggleProfiling}
          disabled={toggleDisabled}
          aria-label={statuses?.profiling ? 'Disable profiling' : 'Enable profiling'}
          title={toggleDisabled ? 'Select an online tree first' : statuses?.profiling ? 'Disable profiling' : 'Enable profiling'}
        >
          <ProfilingIcon />
          <span className="bt-toolbar__studio-toggle-label">Profile</span>
        </button>

        <button
          type="button"
          className={`bt-toolbar__studio-toggle ${statuses?.stateTrace ? 'bt-toolbar__studio-toggle--active' : ''} ${toggleDisabled ? 'bt-toolbar__studio-toggle--disabled' : ''}`}
          onClick={controls.onToggleStateTrace}
          disabled={toggleDisabled}
          aria-label={statuses?.stateTrace ? 'Disable state trace' : 'Enable state trace'}
          title={toggleDisabled ? 'Select an online tree first' : statuses?.stateTrace ? 'Disable state trace' : 'Enable state trace'}
        >
          <TraceIcon />
          <span className="bt-toolbar__studio-toggle-label">Trace</span>
        </button>

        <span className="bt-toolbar__separator" />
      </div>
    ),
    trailing: (
      <button
        type="button"
        className="bt-toolbar__studio-settings-btn"
        onClick={onOpenSettings}
        aria-label="Studio settings"
        title="Studio settings"
      >
        <SettingsIcon />
      </button>
    ),
    connectionBadge: (
      <>
        {conn && (
          <span className={`bt-toolbar__connection-status bt-toolbar__connection-status--${conn.variant}`}>
            <span className="bt-toolbar__connection-dot" />
            {conn.label}
          </span>
        )}
        {controls.byteMetrics != null && (
          <ByteMetricsBadge
            ratePerSecond={controls.byteMetrics.ratePerSecond}
            totalBytes={controls.byteMetrics.totalBytes}
          />
        )}
      </>
    ),
  };
}
