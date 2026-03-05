import { useEffect, useState, useCallback } from 'react';
import type { StudioServerSettings } from '@behavior-tree-ist/react';
import { trpc } from '../trpc';

export function useServerSettings() {
    const [serverSettings, setServerSettings] = useState<StudioServerSettings | null>(null);

    useEffect(() => {
        trpc.settings.get.query().then((result) => {
            setServerSettings({ maxTicksPerTree: result.maxTicksPerTree });
        }).catch((err) => {
            console.log('[use-server-settings] fetch error', err);
        });
    }, []);

    const onServerSettingsChange = useCallback((patch: Partial<StudioServerSettings>) => {
        trpc.settings.update.mutate(patch).then((result) => {
            setServerSettings({ maxTicksPerTree: result.maxTicksPerTree });
        }).catch((err) => {
            console.log('[use-server-settings] update error', err);
        });
    }, []);

    return { serverSettings, onServerSettingsChange };
}
