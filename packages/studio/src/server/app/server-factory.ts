import {
    InMemoryClientRepository,
    InMemoryTreeRepository,
    InMemoryTickRepository,
    InMemorySettingsRepository
} from "../infrastructure/in-memory";
import { StudioService } from "../domain";
import { WebSocketHandler } from "./websocket-handler";
import { RouterContext, appRouter } from "./router";
import * as ws from "ws";
import { createHTTPServer } from "@trpc/server/adapters/standalone";

export type StudioServer = {
    wss: ws.WebSocketServer;
    close: () => Promise<void>;
};

export interface StudioServerOptions {
    port?: number;
    wsPort?: number;
}

export function createStudioServer(options: StudioServerOptions = {}): StudioServer {
    const settingsRepo = new InMemorySettingsRepository();
    const clientRepo = new InMemoryClientRepository();
    const treeRepo = new InMemoryTreeRepository();
    const tickRepo = new InMemoryTickRepository(() => settingsRepo.get());

    // We defer service creation because handler needs service and service needs gateway
    // We'll use a getter or simple factory for the gateway to resolve circular dependency
    let service: StudioService;

    // Create handler first so we have the gateway
    const handler = new WebSocketHandler(
        // We use a proxy to lazily evaluate service since it's not instantiated yet
        new Proxy({} as StudioService, {
            get: (_, prop) => (service as any)[prop]
        })
    );

    // Now instantiate service
    service = new StudioService(clientRepo, treeRepo, tickRepo, handler.gateway);

    // Setup WebSocket Server
    const wss = new ws.WebSocketServer({ port: options.wsPort ?? 4000 });
    wss.on("connection", (ws) => {
        handler.handleConnection(ws);
    });

    // Setup tRPC HTTP Server
    const trpcCtx: RouterContext = {
        clientRepo,
        treeRepo,
        tickRepo,
        settingsRepo,
        service
    };

    const server = createHTTPServer({
        router: appRouter,
        createContext: () => trpcCtx,
    });

    server.listen(options.port ?? 3000);

    return {
        wss,
        close: async () => {
            wss.close();
            await new Promise<void>((resolve, reject) => {
                server.close((err: any) => {
                    if (err) reject(err);
                    else resolve();
                });
            });
        }
    };
}
