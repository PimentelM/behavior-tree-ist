import { MessageType, OutboundMessage } from '@behavior-tree-ist/core';
import { BaseHandler } from './base-handler';
import { WebSocketClientInterface } from '../../../types/interfaces';
import { TickRepositoryInterface, AgentConnectionRegistryInterface, SettingsRepositoryInterface } from '../../../domain/interfaces';

interface TickBatchHandlerDeps {
    tickRepository: TickRepositoryInterface;
    agentConnectionRegistry: AgentConnectionRegistryInterface;
    settingsRepository: SettingsRepositoryInterface;
}

export class TickBatchHandler extends BaseHandler {
    constructor(private deps: TickBatchHandlerDeps, priority = 100) {
        super(priority, 'tick-batch-handler');
    }

    protected async handleMessage(message: OutboundMessage, client: WebSocketClientInterface): Promise<void> {
        if (message.t !== MessageType.TickBatch) return;

        const connection = this.deps.agentConnectionRegistry.getAllConnections()
            .find(c => c.wsClientId === client.id);

        if (!connection) {
            this.logger.warn('TickBatch from unknown client', { wsClientId: client.id });
            return;
        }

        const { clientId, sessionId } = connection;
        const ticks = message.ticks.map(tick => ({
            tickId: tick.tickId,
            timestamp: tick.timestamp,
            payloadJson: JSON.stringify(tick),
        }));

        await this.deps.tickRepository.insertBatch(clientId, sessionId, message.treeId, ticks);

        // Prune old ticks
        const settings = await this.deps.settingsRepository.get();
        await this.deps.tickRepository.pruneToLimit(
            clientId,
            sessionId,
            message.treeId,
            settings.max_ticks_per_tree
        );

        this.logger.debug('Tick batch processed', {
            clientId,
            sessionId,
            treeId: message.treeId,
            count: ticks.length,
        });
    }
}
