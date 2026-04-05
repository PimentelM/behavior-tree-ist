import { type OutboundMessage } from '@bt-studio/core';
import { LogLevelSchema } from '@bt-studio/studio-common';
import { z } from 'zod';
import { BaseHandler } from './base-handler';
import { type MessageConnectionInterface } from '../../../types/interfaces';
import { type AgentConnectionRegistryInterface, type ReplBrokerInterface } from '../../interfaces';
import type { LogRepositoryInterface } from '../../../domain/interfaces';

interface PluginMessageHandlerDeps {
    replBroker: ReplBrokerInterface;
    agentConnectionRegistry: AgentConnectionRegistryInterface;
    logRepository: LogRepositoryInterface;
    maxLogsPerClient: number;
}

// Local shape for PluginMessage fields — matches MessageType.PluginMessage (t=7)
// which is added to OutboundMessage by the core package.
interface PluginMessageFields {
    pluginId: string;
    correlationId: string;
    payload: unknown;
}

const LogsPayloadSchema = z.object({
    timestamp: z.number(),
    level: LogLevelSchema,
    event: z.string(),
    message: z.string(),
});

export class PluginMessageHandler extends BaseHandler {
    constructor(private readonly deps: PluginMessageHandlerDeps) {
        super(100, 'plugin-message-handler');
    }

    protected async handleMessage(message: OutboundMessage, client: MessageConnectionInterface): Promise<void> {
        // The router delivers only PluginMessage (t=7) messages to this handler.
        // Cast is required until core OutboundMessage union includes PluginMessage.
        const { pluginId, correlationId, payload } = message as unknown as PluginMessageFields;

        if (pluginId === 'repl') {
            this.deps.replBroker.handleAgentMessage(client.id, correlationId, payload);
        } else if (pluginId === 'logs') {
            const connection = this.deps.agentConnectionRegistry.getByConnectionId(client.id);
            if (!connection) {
                throw new Error(`Logs plugin message from unknown client ${client.id}`);
            }
            const log = parseLogsPayload(payload);
            await this.deps.logRepository.insert(connection.clientId, connection.sessionId, log);
            await this.deps.logRepository.pruneToLimit(connection.clientId, this.deps.maxLogsPerClient);
        } else {
            this.logger.warn('Received PluginMessage for unknown plugin', { pluginId });
        }
    }
}

function parseLogsPayload(payload: unknown) {
    return LogsPayloadSchema.parse(payload);
}
