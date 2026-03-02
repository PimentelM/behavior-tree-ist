#!/usr/bin/env node

import { parseArgs } from './args.js';
import { MockClientProcess } from './mock-client.js';
import { ProcessManager } from './process-manager.js';
import { createStudioServer } from '../server/app/server-factory.js';

async function main() {
    const args = parseArgs(process.argv.slice(2));
    const processManager = new ProcessManager();

    let studioServer: ReturnType<typeof createStudioServer> | null = null;
    let mockClient: MockClientProcess | null = null;

    processManager.setupSigint(async () => {
        console.log('Shutting down Behavior Tree Studio...');
        if (mockClient) {
            mockClient.stop();
        }
        if (studioServer) {
            await studioServer.close();
        }
    });

    if (args.server) {
        studioServer = createStudioServer({ port: args.port, wsPort: 4000 });
        console.log(`[server] Studio RPC Server running at http://${args.host}:${args.port}`);
        console.log(`[server] Studio WS Server running at ws://${args.host}:4000`);
    }

    if (args.ui) {
        // If server is also starting locally, derive the URL automatically unless overridden
        const serverUrl = args.serverUrl ?? (args.server ? `http://${args.host}:${args.port}` : null);
        processManager.startViteServer(args.uiPort, args.host, serverUrl ?? undefined);
    }

    if (args.mockClient) {
        // Wait slightly to ensure server is binding, or just connect immediately (WS reconnects)
        setTimeout(async () => {
            const wsUrl = `ws://${args.host}:4000`;
            console.log(`[cli] Starting mock client connecting to ${wsUrl}`);
            mockClient = new MockClientProcess(wsUrl);
            await mockClient.start();
        }, 1000);
    }
}

main().catch(err => {
    console.error('[cli] Fatal error:', err);
    process.exit(1);
});
