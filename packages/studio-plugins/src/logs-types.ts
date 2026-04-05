export type { StudioPlugin, PluginSender } from '@bt-studio/core';

export interface LogsPluginPayload {
    timestamp: number;
    level: number;
    event: string;
    message: string;
}
