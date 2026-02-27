import { DARK_THEME, LIGHT_THEME } from '../constants';
import type { ThemeMode, ThemeOverrides } from '../types';

export function buildTheme(mode: ThemeMode, overrides?: ThemeOverrides): Required<ThemeOverrides> {
  const baseTheme = mode === 'light' ? LIGHT_THEME : DARK_THEME;
  return { ...baseTheme, ...overrides };
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
    '--bt-grid-color': `color-mix(in srgb, ${theme.borderColor} 38%, transparent)`,
    '--bt-minimap-mask': `color-mix(in srgb, ${theme.bgPrimary} 70%, transparent)`,
    '--bt-font-family': theme.fontFamily,
    '--bt-font-mono': theme.fontMono,
  };
}
