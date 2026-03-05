import { createTRPCClient, httpBatchLink, type TRPCClient } from '@trpc/client';
import * as net from 'net';
import { createStudioServer, StudioServerHandle, StudioServerOptions } from '../index';
import type { AppRouter } from '../app/handlers/trpc';

export interface TestServiceOptions {
    host?: string;
    port?: number;
    tcpPort?: number;
    serverOptions?: Omit<StudioServerOptions, 'httpHost' | 'httpPort' | 'tcpHost' | 'tcpPort'>;
}

export interface TestServiceInstance {
    host: string;
    port: number;
    tcpHost: string;
    tcpPort: number;
    baseUrl: string;
    wsUrl: string;
    trpc: TRPCClient<AppRouter>;
    shutdown: () => Promise<void>;
}

export async function findAvailablePort(host = '127.0.0.1'): Promise<number> {
    return new Promise((resolve, reject) => {
        const server = net.createServer();
        server.once('error', reject);
        server.listen(0, host, () => {
            const address = server.address();
            const port = typeof address === 'object' && address ? address.port : 0;
            server.close((error) => {
                if (error) {
                    reject(error);
                    return;
                }
                resolve(port);
            });
        });
    });
}

export async function setupTestService(options: TestServiceOptions = {}): Promise<TestServiceInstance> {
    const host = options.host ?? '127.0.0.1';
    const port = options.port ?? await findAvailablePort(host);
    const tcpPort = options.tcpPort ?? await findAvailablePort(host);

    const server: StudioServerHandle = createStudioServer({
        httpHost: host,
        httpPort: port,
        tcpHost: host,
        tcpPort,
        sqlitePath: ':memory:',
        ...options.serverOptions,
    });
    await server.start();

    const baseUrl = `http://${host}:${port}`;
    const trpc = createTRPCClient<AppRouter>({
        links: [
            httpBatchLink({
                url: `${baseUrl}/trpc`,
            }),
        ],
    });

    return {
        host,
        port,
        tcpHost: host,
        tcpPort,
        baseUrl,
        wsUrl: `ws://${host}:${port}/ws`,
        trpc,
        shutdown: async () => {
            await server.stop();
        },
    };
}

export function withTestService(options: TestServiceOptions = {}) {
    let service: TestServiceInstance | undefined;

    return {
        beforeAll: async () => {
            service = await setupTestService(options);
            return service;
        },
        afterAll: async () => {
            if (!service) {
                return;
            }
            await service.shutdown();
            service = undefined;
        },
        getService: () => {
            if (!service) {
                throw new Error('Test service not initialized. Call beforeAll first.');
            }
            return service;
        },
    };
}
