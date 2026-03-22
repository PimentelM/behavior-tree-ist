import { MessageType, type OutboundMessage } from '@bt-studio/core';
import { BaseHandler } from './base-handler';
import { type MessageConnectionInterface } from '../../../types/interfaces';
import { type TickRepositoryInterface } from '../../../domain/interfaces';
import { type AgentConnectionRegistryInterface, type ByteMetricsServiceInterface } from '../../interfaces';

export interface RuntimeSettingsRef {
    maxTicksPerTree: number;
}

interface TickBatchHandlerDeps {
    tickRepository: TickRepositoryInterface;
    agentConnectionRegistry: AgentConnectionRegistryInterface;
    runtimeSettings: RuntimeSettingsRef;
    byteMetricsService: ByteMetricsServiceInterface;
}

const BYTES_PER_TICK_ESTIMATE = 512;
const PRUNE_INTERVAL_BATCHES = 10;

export class TickBatchHandler extends BaseHandler {
    private batchCount = 0;

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

        // Record byte metrics — rough estimate avoids re-serializing the whole message
        const bytes = message.ticks.length * BYTES_PER_TICK_ESTIMATE;
        const lastTick = message.ticks[message.ticks.length - 1];
        if (lastTick !== undefined) {
            this.deps.byteMetricsService.record(clientId, sessionId, message.treeId, lastTick.tickId, bytes);
        }

        await this.deps.tickRepository.insertBatch(clientId, sessionId, message.treeId, message.ticks);

        // Prune periodically (every N batches) to avoid blocking on every insert
        this.batchCount++;
        if (this.batchCount % PRUNE_INTERVAL_BATCHES === 0) {
            await this.deps.tickRepository.pruneToLimit(
                clientId,
                sessionId,
                message.treeId,
                this.deps.runtimeSettings.maxTicksPerTree
            );
        }

        this.logger.debug('Tick batch processed', {
            clientId,
            sessionId,
            treeId: message.treeId,
            count: message.ticks.length,
        });
    }
}
