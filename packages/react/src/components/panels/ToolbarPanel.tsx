import { memo } from 'react';
import type { ReactNode } from 'react';
import type { ThemeMode } from '../../types';

interface ToolbarPanelProps {
  showSidebar: boolean;
  actions?: ReactNode;
  showThemeToggle: boolean;
  themeMode: ThemeMode;
  onToggleTheme?: () => void;
  onCenterTree?: () => void;
  timeTravelMode: 'live' | 'paused';
  viewedTickId: number | null;
  viewedNow: number | null;
  displayTimeAsTimestamp: boolean;
  onToggleTimeFormat?: () => void;
  onToggleTimeTravel?: () => void;
}

function formatNowValue(now: number | null, nowIsTimestamp: boolean | null): string | null {
  if (now === null) return null;
  if (!nowIsTimestamp) return `${now}`;

  const timestampMs = Math.abs(now) >= 1e12 ? now : now * 1000;
  const date = new Date(timestampMs);
  const hh = `${date.getHours()}`.padStart(2, '0');
  const mm = `${date.getMinutes()}`.padStart(2, '0');
  const ss = `${date.getSeconds()}`.padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

function ToolbarPanelInner({
  showSidebar,
  actions,
  showThemeToggle,
  themeMode,
  onToggleTheme,
  onCenterTree,
  timeTravelMode,
  viewedTickId,
  viewedNow,
  displayTimeAsTimestamp,
  onToggleTimeFormat,
  onToggleTimeTravel,
}: ToolbarPanelProps) {
  const formattedNow = formatNowValue(viewedNow, displayTimeAsTimestamp);
  const toggleTimeFormatLabel = displayTimeAsTimestamp ? 'Show time as number' : 'Show time as timestamp';

  if (showSidebar) {
    return (
      <div className="bt-toolbar bt-toolbar--split">
        <div className="bt-toolbar__main">
          <div className="bt-toolbar__main-actions">
            <div className="bt-toolbar__actions">
              <button
                className="bt-toolbar__camera-btn"
                onClick={onCenterTree}
                type="button"
                aria-label="Center tree"
                title="Center tree"
              >
                <CenterIcon />
              </button>
              {actions}
            </div>
          </div>
          <div className="bt-toolbar__main-center">
            <div className={`bt-toolbar__travel-indicator bt-toolbar__travel-indicator--${timeTravelMode}`}>
              {timeTravelMode === 'paused'
                ? `Time Travel · tick #${viewedTickId ?? '-'}${formattedNow !== null ? ` · time ${formattedNow}` : ''} `
                : `Live${formattedNow !== null ? ` · time ${formattedNow}` : ''}`}
            </div>
          </div>
          <div className="bt-toolbar__main-trailing">
            <button
              className="bt-toolbar__time-format-btn"
              onClick={onToggleTimeFormat}
              type="button"
              aria-label={toggleTimeFormatLabel}
              title={toggleTimeFormatLabel}
            >
              <ClockIcon />
              <span className="bt-toolbar__time-format-mode" aria-hidden="true">
                {displayTimeAsTimestamp ? '::' : '#'}
              </span>
            </button>
            {showThemeToggle && (
              <button
                className="bt-toolbar__theme-btn"
                onClick={onToggleTheme}
                type="button"
                aria-label={themeMode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                title={themeMode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                {themeMode === 'dark' ? <SunIcon /> : <MoonIcon />}
              </button>
            )}
          </div>
        </div>
        <div className="bt-toolbar__sidebar">
          <button
            className={`bt-toolbar__mode-btn ${timeTravelMode === 'paused' ? 'bt-toolbar__mode-btn--live' : 'bt-toolbar__mode-btn--pause'}`}
            onClick={onToggleTimeTravel}
            type="button"
            aria-label={timeTravelMode === 'paused' ? 'Resume live mode' : 'Pause and enter time travel'}
            title={timeTravelMode === 'paused' ? 'Resume live mode' : 'Pause and enter time travel'}
          >
            {timeTravelMode === 'paused' ? '▶ Live' : '⏸ Pause'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bt-toolbar">
      <div className="bt-toolbar__actions">
        <button
          className={`bt-toolbar__mode-btn ${timeTravelMode === 'paused' ? 'bt-toolbar__mode-btn--live' : 'bt-toolbar__mode-btn--pause'}`}
          onClick={onToggleTimeTravel}
          type="button"
          aria-label={timeTravelMode === 'paused' ? 'Resume live mode' : 'Pause and enter time travel'}
          title={timeTravelMode === 'paused' ? 'Resume live mode' : 'Pause and enter time travel'}
        >
          {timeTravelMode === 'paused' ? '▶ Live' : '⏸ Pause'}
        </button>
        <button
          className="bt-toolbar__camera-btn"
          onClick={onCenterTree}
          type="button"
          aria-label="Center tree"
          title="Center tree"
        >
          <CenterIcon />
        </button>
        {actions}
        <button
          className="bt-toolbar__time-format-btn"
          onClick={onToggleTimeFormat}
          type="button"
          aria-label={toggleTimeFormatLabel}
          title={toggleTimeFormatLabel}
        >
          <ClockIcon />
          <span className="bt-toolbar__time-format-mode" aria-hidden="true">
            {displayTimeAsTimestamp ? '::' : '#'}
          </span>
        </button>
      </div>
      <div className={`bt-toolbar__travel-indicator bt-toolbar__travel-indicator--${timeTravelMode}`}>
        {timeTravelMode === 'paused'
          ? `Time Travel · tick #${viewedTickId ?? '-'}${formattedNow !== null ? ` · time ${formattedNow}` : ''} `
          : `Live${formattedNow !== null ? ` · time ${formattedNow}` : ''}`}
      </div>
      {showThemeToggle && (
        <button
          className="bt-toolbar__theme-btn"
          onClick={onToggleTheme}
          type="button"
          aria-label={themeMode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          title={themeMode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {themeMode === 'dark' ? <SunIcon /> : <MoonIcon />}
        </button>
      )}
    </div>
  );
}

function CenterIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="bt-toolbar__icon">
      <circle cx="12" cy="12" r="2.2" fill="currentColor" />
      <path
        d="M12 3v3M12 18v3M3 12h3M18 12h3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <circle cx="12" cy="12" r="6" fill="none" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="bt-toolbar__icon">
      <circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M12 2v2.2M12 19.8V22M4.9 4.9l1.6 1.6M17.5 17.5l1.6 1.6M2 12h2.2M19.8 12H22M4.9 19.1l1.6-1.6M17.5 6.5l1.6-1.6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="bt-toolbar__icon">
      <path
        d="M21 13.2A8.6 8.6 0 1 1 10.8 3c-.1.4-.2.9-.2 1.4a8.7 8.7 0 0 0 8.7 8.8c.6 0 1.1-.1 1.7-.2z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="bt-toolbar__icon">
      <circle cx="12" cy="12" r="7" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M12 8v4.2l2.8 1.6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export const ToolbarPanel = memo(ToolbarPanelInner);
