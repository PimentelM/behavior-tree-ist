import { describe, expect, it, vi } from 'vitest';
import { LogsPlugin } from './logs-plugin';
import type { PluginSender } from '@bt-studio/core';

describe('LogsPlugin', () => {
    it('uses logs plugin id', () => {
        expect(new LogsPlugin().pluginId).toBe('logs');
    });

    it('sends payload through attached sender', () => {
        const send = vi.fn();
        const sender: PluginSender = { send };
        const plugin = new LogsPlugin();
        plugin.attach(sender);

        plugin.send({
            timestamp: 123,
            level: 2,
            event: 'Boot',
            message: 'Ready',
        });

        expect(send).toHaveBeenCalledWith('log', {
            timestamp: 123,
            level: 2,
            event: 'Boot',
            message: 'Ready',
        });
    });

    it('ignores inbound messages', async () => {
        const plugin = new LogsPlugin();

        plugin.handleInbound();

        await expect(Promise.resolve()).resolves.toBeUndefined();
    });
});
