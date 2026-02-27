import { DEFAULT_THEME } from '../constants';
import type { ThemeOverrides } from '../types';

export function buildTheme(overrides?: ThemeOverrides): Required<ThemeOverrides> {
  return { ...DEFAULT_THEME, ...overrides };
}

export function themeToCSSVars(theme: Required<ThemeOverrides>): Record<string, string> {
  return {
    '--bt-color-succeeded': theme.colorSucceeded,
    '--bt-color-failed': theme.colorFailed,
    '--bt-color-running': theme.colorRunning,
    '--bt-color-idle': theme.colorIdle,
    '--bt-bg-primary': theme.bgPrimary,
    '--bt-bg-secondary': theme.bgSecondary,
    '--bt-bg-tertiary': theme.bgTertiary,
    '--bt-text-primary': theme.textPrimary,
    '--bt-text-secondary': theme.textSecondary,
    '--bt-text-muted': theme.textMuted,
    '--bt-border-color': theme.borderColor,
    '--bt-accent-color': theme.accentColor,
    '--bt-font-family': theme.fontFamily,
    '--bt-font-mono': theme.fontMono,
  };
}
