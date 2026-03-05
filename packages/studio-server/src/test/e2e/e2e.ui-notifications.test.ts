import { randomUUID } from 'crypto';
import { afterAll, beforeAll, describe, it } from 'vitest';
import WebSocket, { RawData } from 'ws';
import { UiInboundMessage, UiInboundMessageSchema, UiMessageType } from '@behavior-tree-ist/studio-common';
import { WsNodeStringTransport } from '@behavior-tree-ist/studio-transport/node';
import { Action, BehaviourTree, NodeResult, StudioAgent, StudioLink, TreeRegistry } from '@behavior-tree-ist/core';
import { withTestService, type TestServiceInstance } from '../test-service-setup';

async function waitFor(
    predicate: () => Promise<boolean> | boolean,
    timeoutMs = 5000,
    pollMs = 20,
): Promise<void> {
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
        if (await predicate()) {
            return;
        }
        await new Promise((resolve) => setTimeout(resolve, pollMs));
    }

    throw new Error(`waitFor timed out after ${timeoutMs}ms`);
}

function rawDataToString(data: RawData): string {
    if (typeof data === 'string') return data;
    if (data instanceof ArrayBuffer) return Buffer.from(data).toString('utf8');
    if (Array.isArray(data)) return Buffer.concat(data).toString('utf8');
    return data.toString('utf8');
}

async function connectWebSocket(url: string): Promise<WebSocket> {
    return new Promise((resolve, reject) => {
        const socket = new WebSocket(url);

        const cleanup = () => {
            socket.off('open', onOpen);
            socket.off('error', onError);
        };

        const onOpen = () => {
            cleanup();
            resolve(socket);
        };

        const onError = (error: Error) => {
            cleanup();
            reject(error);
        };

        socket.once('open', onOpen);
        socket.once('error', onError);
    });
}

async function closeWebSocket(socket: WebSocket): Promise<void> {
    if (socket.readyState === WebSocket.CLOSED) return;

    await new Promise<void>((resolve) => {
        socket.once('close', () => resolve());
        socket.close();
    });
}

async function waitForUiMessage(
    uiMessages: UiInboundMessage[],
    parseErrors: string[],
    predicate: (message: UiInboundMessage) => boolean,
    timeoutMs = 5000,
): Promise<UiInboundMessage> {
    let foundMessage: UiInboundMessage | undefined;

    await waitFor(async () => {
        if (parseErrors.length > 0) {
            throw new Error(`Failed to parse UI message: ${parseErrors[0]}`);
        }

        const messageIndex = uiMessages.findIndex(predicate);
        if (messageIndex === -1) return false;

        foundMessage = uiMessages.splice(messageIndex, 1)[0];
        return true;
    }, timeoutMs);

    if (!foundMessage) {
        throw new Error('Expected UI message was not captured');
    }

    return foundMessage;
}

describe('Studio Server E2E (UI notifications)', () => {
    const testService = withTestService();
    let service: TestServiceInstance;

    beforeAll(async () => {
        service = await testService.beforeAll();
    });

    afterAll(async () => {
        await testService.afterAll();
    });

    it('notifies a connected UI about agent lifecycle and catalog changes', async () => {
        const uiWsUrl = `ws://${service.host}:${service.port}/ui-ws`;
        const uiSocket = await connectWebSocket(uiWsUrl);
        const uiMessages: UiInboundMessage[] = [];
        const parseErrors: string[] = [];

        const onMessage = (rawMessage: RawData) => {
            const rawText = rawDataToString(rawMessage);

            try {
                const decoded = JSON.parse(rawText) as unknown;
                const parsed = UiInboundMessageSchema.safeParse(decoded);

                if (!parsed.success) {
                    parseErrors.push(parsed.error.message);
                    return;
                }

                uiMessages.push(parsed.data);
            } catch (error) {
                parseErrors.push(String(error));
            }
        };

        uiSocket.on('message', onMessage);

        let agent: StudioAgent | undefined;

        try {
            const clientId = `test-client-${randomUUID()}`;
            const sessionId = `test-session-${randomUUID()}`;

            const registry = new TreeRegistry();
            const link = new StudioLink({
                createTransport: WsNodeStringTransport.createFactory(service.wsUrl),
                reconnectDelayMs: 100,
            });

            agent = new StudioAgent({
                clientId,
                sessionId,
                registry,
                link,
            });

            agent.start();

            await waitFor(() => agent?.isConnected ?? false);

            await waitForUiMessage(
                uiMessages,
                parseErrors,
                (message) =>
                    message.t === UiMessageType.AgentOnline
                    && message.clientId === clientId
                    && message.sessionId === sessionId,
            );

            const treeId = `test-tree-${randomUUID()}`;
            registry.register(
                treeId,
                new BehaviourTree(Action.from('TestAction', () => NodeResult.Succeeded)),
            );

            await waitForUiMessage(
                uiMessages,
                parseErrors,
                (message) =>
                    message.t === UiMessageType.CatalogChanged
                    && message.clientId === clientId
                    && message.sessionId === sessionId,
            );

            registry.remove(treeId);

            await waitForUiMessage(
                uiMessages,
                parseErrors,
                (message) =>
                    message.t === UiMessageType.CatalogChanged
                    && message.clientId === clientId
                    && message.sessionId === sessionId,
            );

            agent.destroy();

            await waitForUiMessage(
                uiMessages,
                parseErrors,
                (message) =>
                    message.t === UiMessageType.AgentOffline
                    && message.clientId === clientId
                    && message.sessionId === sessionId,
            );
        } finally {
            agent?.destroy();
            uiSocket.off('message', onMessage);
            await closeWebSocket(uiSocket);
        }
    });
});
