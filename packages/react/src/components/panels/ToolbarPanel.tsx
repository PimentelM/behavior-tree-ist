import { memo } from 'react';
import type { ReactNode } from 'react';
import type { ThemeMode } from '../../types';

interface ToolbarPanelProps {
  actions?: ReactNode;
  showThemeToggle: boolean;
  themeMode: ThemeMode;
  onToggleTheme?: () => void;
  onCenterTree?: () => void;
}

function ToolbarPanelInner({
  actions,
  showThemeToggle,
  themeMode,
  onToggleTheme,
  onCenterTree,
}: ToolbarPanelProps) {
  return (
    <div className="bt-toolbar">
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

export const ToolbarPanel = memo(ToolbarPanelInner);
