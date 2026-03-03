import {
    CommandResponse,
    MessageType,
    StudioCommand,
    StudioCommandType,
} from '@behavior-tree-ist/core';
import { describe, expect, it } from 'vitest';
import { WebSocketServerConfigInterface, WebSocketServerInterface } from '../../infra/websocket/interfaces';
import { CommandBroker } from './command-broker';
import { WebSocketClientInterface } from '../../types/interfaces';
import { IncomingMessage } from 'http';

class FakeWebSocketServer implements WebSocketServerInterface {
    public readonly sent: Array<{ clientId: string; message: object }> = [];

    async start(_config: WebSocketServerConfigInterface): Promise<void> {
        return;
    }

    async stop(): Promise<void> {
        return;
    }

    broadcast(_message: object): void {}

    sendToClient(clientId: string, message: object): void {
        this.sent.push({ clientId, message });
    }

    onConnection(_handler: (client: WebSocketClientInterface, request: IncomingMessage) => void): void {}

    onDisconnection(_handler: (clientId: string) => void): void {}

    getClient(_clientId: string): undefined {
        return undefined;
    }

    getClients(): Map<string, WebSocketClientInterface> {
        return new Map();
    }

    getClientCount(): number {
        return 0;
    }
}

function makeCommand(overrides: Partial<StudioCommand> = {}): StudioCommand {
    return {
        correlationId: 'corr-1',
        treeId: 'tree-1',
        command: StudioCommandType.GetTreeStatuses,
        ...overrides,
    };
}

describe('CommandBroker', () => {
    it('sends command messages and resolves when response is received', async () => {
        const wsServer = new FakeWebSocketServer();
        const broker = new CommandBroker(wsServer, 1000);
        const command = makeCommand();
        const expectedResponse: CommandResponse = { success: true };

        const pending = broker.sendCommand('ws-client-1', command);

        expect(wsServer.sent).toHaveLength(1);
        expect(wsServer.sent[0].clientId).toBe('ws-client-1');
        expect(wsServer.sent[0].message).toEqual({
            t: MessageType.Command,
            command,
        });

        broker.handleResponse(command.correlationId, expectedResponse);
        await expect(pending).resolves.toEqual(expectedResponse);
    });

    it('rejects commands that timeout', async () => {
        const wsServer = new FakeWebSocketServer();
        const broker = new CommandBroker(wsServer, 20);

        const pending = broker.sendCommand('ws-client-1', makeCommand({ correlationId: 'timeout-1' }));
        await expect(pending).rejects.toThrow(/timed out/);
    });

    it('rejects pending commands on shutdown', async () => {
        const wsServer = new FakeWebSocketServer();
        const broker = new CommandBroker(wsServer, 5000);

        const pending = broker.sendCommand('ws-client-1', makeCommand({ correlationId: 'shutdown-1' }));
        broker.shutdown();

        await expect(pending).rejects.toThrow(/shutting down/);
    });
});
