import { useEffect, useState, useCallback } from 'react';
import type { StudioServerSettings } from '@bt-studio/react';
import { trpc } from '../trpc';

export function useServerSettings() {
    const [serverSettings, setServerSettings] = useState<StudioServerSettings | null>(null);

    useEffect(() => {
        trpc.settings.get.query().then((result) => {
            setServerSettings({ maxTicksPerTree: result.maxTicksPerTree });
        }).catch((_err: unknown) => {
            // eslint-disable-next-line no-console
            console.log('[use-server-settings] fetch error', _err);
        });
    }, []);

    const onServerSettingsChange = useCallback((patch: Partial<StudioServerSettings>) => {
        trpc.settings.update.mutate(patch).then((result) => {
            setServerSettings({ maxTicksPerTree: result.maxTicksPerTree });
        }).catch((_err: unknown) => {
            // eslint-disable-next-line no-console
            console.log('[use-server-settings] update error', _err);
        });
    }, []);

    return { serverSettings, onServerSettingsChange };
}
