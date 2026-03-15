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

    protected async handleMessage(message: OutboundMessage, _client: MessageConnectionInterface): Promise<void> {
        // The router delivers only PluginMessage (t=7) messages to this handler.
        // Cast is required until core OutboundMessage union includes PluginMessage.
        const { pluginId, correlationId, payload } = message as unknown as PluginMessageFields;

        if (pluginId === 'repl') {
            this.deps.replBroker.handleAgentResponse(correlationId, payload);
        } else {
            this.logger.warn('Received PluginMessage for unknown plugin', { pluginId });
        }
    }
}
