import { MessageType, type OutboundMessage } from '@bt-studio/core';
import { BaseHandler } from './base-handler';
import { type MessageConnectionInterface } from '../../../types/interfaces';
import { type TickRepositoryInterface, type SettingsRepositoryInterface } from '../../../domain/interfaces';
import { type AgentConnectionRegistryInterface } from '../../interfaces';
import { type ByteMetricsService } from '../../services/byte-metrics-service';

interface TickBatchHandlerDeps {
    tickRepository: TickRepositoryInterface;
    agentConnectionRegistry: AgentConnectionRegistryInterface;
    settingsRepository: SettingsRepositoryInterface;
    byteMetricsService: ByteMetricsService;
}

export class TickBatchHandler extends BaseHandler {
    constructor(private deps: TickBatchHandlerDeps, priority = 100) {
        super(priority, 'tick-batch-handler');
    }

    protected async handleMessage(message: OutboundMessage, client: MessageConnectionInterface): Promise<void> {
        if (message.t !== MessageType.TickBatch) return;

        const connection = this.deps.agentConnectionRegistry.getByConnectionId(client.id);

        if (!connection) {
            this.logger.warn('TickBatch from unknown client', { connectionId: client.id, transport: client.transport });
            return;
        }

        const { clientId, sessionId } = connection;

        const firstTickId = message.ticks.length > 0 ? message.ticks[0].tickId : 0;
        this.deps.byteMetricsService.record(clientId, sessionId, message.treeId, firstTickId, client.lastRawByteSize);

        await this.deps.tickRepository.insertBatch(clientId, sessionId, message.treeId, message.ticks);

        // Prune old ticks
        const settings = await this.deps.settingsRepository.get();
        await this.deps.tickRepository.pruneToLimit(
            clientId,
            sessionId,
            message.treeId,
            settings.maxTicksPerTree
        );

        this.logger.debug('Tick batch processed', {
            clientId,
            sessionId,
            treeId: message.treeId,
            count: message.ticks.length,
        });
    }
}
