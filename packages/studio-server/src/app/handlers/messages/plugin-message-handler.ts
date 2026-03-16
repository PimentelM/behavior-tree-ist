import { type OutboundMessage } from '@bt-studio/core';
import { BaseHandler } from './base-handler';
import { type MessageConnectionInterface } from '../../../types/interfaces';
import { type ReplBrokerInterface } from '../../interfaces';

interface PluginMessageHandlerDeps {
    replBroker: ReplBrokerInterface;
}

// Local shape for PluginMessage fields — matches MessageType.PluginMessage (t=7)
// which is added to OutboundMessage by the core package.
interface PluginMessageFields {
    pluginId: string;
    correlationId: string;
    payload: unknown;
}

export class PluginMessageHandler extends BaseHandler {
    constructor(private readonly deps: PluginMessageHandlerDeps) {
        super(100, 'plugin-message-handler');
    }

    // eslint-disable-next-line @typescript-eslint/require-await
    protected async handleMessage(message: OutboundMessage, client: MessageConnectionInterface): Promise<void> {
        // The router delivers only PluginMessage (t=7) messages to this handler.
        // Cast is required until core OutboundMessage union includes PluginMessage.
        const { pluginId, correlationId, payload } = message as unknown as PluginMessageFields;

        if (pluginId === 'repl') {
            this.deps.replBroker.handleAgentMessage(client.id, correlationId, payload);
        } else {
            this.logger.warn('Received PluginMessage for unknown plugin', { pluginId });
        }
    }
}
