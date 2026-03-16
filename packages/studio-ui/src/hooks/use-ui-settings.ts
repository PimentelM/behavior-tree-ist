import { useState, useCallback } from 'react';
import type { StudioUiSettings } from '@bt-studio/react';

const STORAGE_KEY = 'bt-studio-ui-settings';

const DEFAULTS: StudioUiSettings = {
    ringBufferSize: 500,
    pollRateMs: 200,
    showTreeSelectorInToolbar: false,
};

function loadSettings(): StudioUiSettings {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<StudioUiSettings>) };
    } catch { /* ignore */ }
    return DEFAULTS;
}

function saveSettings(settings: StudioUiSettings) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch { /* ignore */ }
}

export function useUiSettings() {
    const [uiSettings, setUiSettings] = useState<StudioUiSettings>(loadSettings);

    const onUiSettingsChange = useCallback((patch: Partial<StudioUiSettings>) => {
        setUiSettings((prev) => {
            const next = { ...prev, ...patch };
            saveSettings(next);
            return next;
        });
    }, []);

    return { uiSettings, onUiSettingsChange };
}
