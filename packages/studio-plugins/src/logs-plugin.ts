import type { PluginSender, StudioPlugin } from '@bt-studio/core';
import type { LogsPluginPayload } from './logs-types';

export class LogsPlugin implements StudioPlugin {
    readonly pluginId = 'logs';

    private sender?: PluginSender;

    attach(send: PluginSender): void {
        this.sender = send;
    }

    detach(): void {
        this.sender = undefined;
    }

    handleInbound(): void {
        // Intentionally write-only in v1.
    }

    send(entry: LogsPluginPayload): void {
        this.sender?.send('log', entry);
    }
}
