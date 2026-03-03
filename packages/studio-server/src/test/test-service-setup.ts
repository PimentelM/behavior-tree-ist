import { createTRPCClient, httpBatchLink, type TRPCClient } from '@trpc/client';
import * as net from 'net';
import { createStudioServer, StudioServerHandle, StudioServerOptions } from '../index';
import type { AppRouter } from '../app/trpc';

export interface TestServiceOptions {
    host?: string;
    port?: number;
    serverOptions?: Omit<StudioServerOptions, 'httpHost' | 'httpPort'>;
}

export interface TestServiceInstance {
    host: string;
    port: number;
    baseUrl: string;
    wsUrl: string;
    trpc: TRPCClient<AppRouter>;
    shutdown: () => Promise<void>;
}

export async function findAvailablePort(): Promise<number> {
    return new Promise((resolve, reject) => {
        const server = net.createServer();
        server.once('error', reject);
        server.listen(0, () => {
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
    const port = options.port ?? await findAvailablePort();

    const server: StudioServerHandle = createStudioServer({
        httpHost: host,
        httpPort: port,
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
