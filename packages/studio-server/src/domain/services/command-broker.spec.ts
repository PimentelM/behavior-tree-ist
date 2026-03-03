import {
    CommandResponse,
    MessageType,
    StudioCommand,
    StudioCommandType,
} from '@behavior-tree-ist/core';
import { describe, expect, it } from 'vitest';
import { CommandBroker } from './command-broker';
import type { CommandSenderInterface } from '../interfaces';

class FakeCommandSender implements CommandSenderInterface {
    public readonly sent: Array<{ clientId: string; message: object }> = [];

    sendToClient(clientId: string, message: object): void {
        this.sent.push({ clientId, message });
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
        const sender = new FakeCommandSender();
        const broker = new CommandBroker(sender, 1000);
        const command = makeCommand();
        const expectedResponse: CommandResponse = { success: true };

        const pending = broker.sendCommand('ws-client-1', command);

        expect(sender.sent).toHaveLength(1);
        expect(sender.sent[0].clientId).toBe('ws-client-1');
        expect(sender.sent[0].message).toEqual({
            t: MessageType.Command,
            command,
        });

        broker.handleResponse(command.correlationId, expectedResponse);
        await expect(pending).resolves.toEqual(expectedResponse);
    });

    it('rejects commands that timeout', async () => {
        const sender = new FakeCommandSender();
        const broker = new CommandBroker(sender, 20);

        const pending = broker.sendCommand('ws-client-1', makeCommand({ correlationId: 'timeout-1' }));
        await expect(pending).rejects.toThrow(/timed out/);
    });

    it('rejects pending commands on shutdown', async () => {
        const sender = new FakeCommandSender();
        const broker = new CommandBroker(sender, 5000);

        const pending = broker.sendCommand('ws-client-1', makeCommand({ correlationId: 'shutdown-1' }));
        broker.shutdown();

        await expect(pending).rejects.toThrow(/shutting down/);
    });
});
