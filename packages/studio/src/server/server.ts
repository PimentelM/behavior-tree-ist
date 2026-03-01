import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { statSync, existsSync, readFileSync } from 'node:fs';
import type { Socket } from 'node:net';
import { join, normalize } from 'node:path';
import { WebSocketServer, type WebSocket } from 'ws';
import type { TickRecord } from '@behavior-tree-ist/core';
import type { AgentTreeInfo } from '@behavior-tree-ist/core/studio';
import { AgentChannel } from './agent-channel';
import { SessionStore } from './session-store';
import { TickBufferStore } from './tick-buffer';
import { UiChannel } from './ui-channel';

export interface StudioServerOptions {
  host?: string;
  uiPort?: number;
  staticDir?: string;
  uiWsPath?: string;
  agentWsPath?: string;
  uiPushMs?: number;
  heartbeatTimeoutMs?: number;
  maxTicksPerTree?: number;
}

type TreeStreamKey = string;

function makeStreamKey(agentId: string, treeKey: string): TreeStreamKey {
  return `${agentId}::${treeKey}`;
}

export class StudioServer {
  private readonly host: string;
  private readonly uiPort: number;
  private readonly staticDir: string;
  private readonly uiWsPath: string;
  private readonly agentWsPath: string;
  private readonly uiPushMs: number;
  private readonly heartbeatTimeoutMs: number;
  private readonly tickBuffer: TickBufferStore;

  private readonly session = new SessionStore();
  private readonly agentChannel = new AgentChannel();
  private readonly uiChannel = new UiChannel();
  private readonly latestTreeSnapshots = new Map<TreeStreamKey, unknown>();

  private readonly httpServer = createServer(this.handleHttpRequest.bind(this));
  private readonly uiWss = new WebSocketServer({ noServer: true });
  private readonly agentWss = new WebSocketServer({ noServer: true });

  private uiPushTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;

  constructor(options: StudioServerOptions = {}) {
    this.host = options.host ?? '0.0.0.0';
    this.uiPort = options.uiPort ?? 3000;
    this.staticDir = options.staticDir ?? join(process.cwd(), 'dist', 'ui');
    this.uiWsPath = options.uiWsPath ?? '/api/ui/ws';
    this.agentWsPath = options.agentWsPath ?? '/api/agent/ws';
    this.uiPushMs = options.uiPushMs ?? 200;
    this.heartbeatTimeoutMs = options.heartbeatTimeoutMs ?? 10_000;
    this.tickBuffer = new TickBufferStore(options.maxTicksPerTree ?? 5000);

    this.agentChannel.onAgentsChanged(() => {
      this.uiChannel.broadcastEvent('ui.agentListChanged', {
        agents: this.agentChannel.getAgentSnapshotList(),
      });

      const selectedAgentId = this.session.selectedAgentId;
      if (!selectedAgentId) {
        return;
      }

      const selectedAgentStillExists = this.agentChannel.getAgentSnapshotList().some((agent) => agent.id === selectedAgentId);
      if (!selectedAgentStillExists) {
        this.session.selectedAgentId = null;
        this.session.selectedTreeKey = null;
        this.uiChannel.broadcastEvent('ui.treeListChanged', { trees: [] });
        return;
      }

      this.uiChannel.broadcastEvent('ui.treeListChanged', {
        trees: this.agentChannel.getAgentTrees(selectedAgentId),
      });
    });

    this.agentChannel.onTreeUpdated(({ agentId, treeKey, tree }) => {
      this.latestTreeSnapshots.set(makeStreamKey(agentId, treeKey), tree);
      if (this.session.selectedAgentId === agentId && this.session.selectedTreeKey === treeKey) {
        this.uiChannel.broadcastEvent('ui.treeSnapshot', { treeKey, tree });
      }
    });

    this.agentChannel.onTickBatch(({ agentId, treeKey, ticks }) => {
      this.tickBuffer.append(makeStreamKey(agentId, treeKey), ticks as TickRecord[]);
    });

    this.agentChannel.onWarning(({ message }) => {
      this.uiChannel.broadcastEvent('ui.warning', {
        code: 'AGENT_WARNING',
        message,
      });
    });

    this.uiChannel.onRequest(async (clientId, request) => {
      switch (request.method) {
        case 'ui.getSessionState': {
          return this.createUiSessionState();
        }
        case 'ui.heartbeat': {
          this.uiChannel.updateHeartbeat(clientId, Date.now());
          return { ok: true };
        }
        case 'ui.configureChannel': {
          this.session.mode = request.params.mode;
          if (request.params.mode === 'connect' && request.params.connect?.url) {
            const agentId = await this.agentChannel.connectToUrl(request.params.connect.url);
            this.session.selectedAgentId = agentId;
            const trees = this.agentChannel.getAgentTrees(agentId);
            this.session.selectedTreeKey = trees[0]?.treeKey ?? null;
          }
          return { ok: true, mode: this.session.mode };
        }
        case 'ui.selectAgent': {
          this.session.selectedAgentId = request.params.agentId;
          const trees = this.agentChannel.getAgentTrees(request.params.agentId);
          this.session.selectedTreeKey = trees[0]?.treeKey ?? null;
          this.uiChannel.broadcastEvent('ui.treeListChanged', { trees });
          return { ok: true };
        }
        case 'ui.selectTree': {
          this.session.selectedTreeKey = request.params.treeKey;
          await this.pushTreeSnapshotIfAvailable();
          return { ok: true };
        }
        case 'ui.setCapture': {
          const selectedAgentId = this.session.selectedAgentId;
          if (!selectedAgentId) {
            throw new Error('No selected agent');
          }

          const params = { ...request.params };
          if (params.scope === 'tree' && !params.treeKey) {
            params.treeKey = this.session.selectedTreeKey ?? undefined;
          }

          await this.agentChannel.requestSetCapture(selectedAgentId, params);
          return { ok: true };
        }
      }
    });

    this.httpServer.on('upgrade', (request: IncomingMessage, socket: Socket, head: Buffer) => {
      const pathname = this.getRequestPathname(request);
      if (pathname === this.uiWsPath) {
        this.uiWss.handleUpgrade(request, socket, head, (ws: WebSocket) => {
          this.handleUiSocket(ws);
        });
        return;
      }

      if (pathname === this.agentWsPath) {
        this.agentWss.handleUpgrade(request, socket, head, (ws: WebSocket) => {
          this.agentChannel.attachSocket(ws, 'listen');
        });
        return;
      }

      socket.destroy();
    });
  }

  public async start(): Promise<void> {
    await new Promise<void>((resolve) => {
      this.httpServer.listen(this.uiPort, this.host, () => resolve());
    });

    this.uiPushTimer = setInterval(() => {
      this.flushTicksToUi();
    }, this.uiPushMs);

    this.heartbeatTimer = setInterval(() => {
      const disconnected = this.uiChannel.disconnectStale(this.heartbeatTimeoutMs, Date.now());
      if (disconnected.length > 0 && this.uiChannel.getClientCount() === 0) {
        void this.rollbackAfterUiDisconnect();
      }
    }, 1000);
  }

  public async stop(): Promise<void> {
    if (this.uiPushTimer) {
      clearInterval(this.uiPushTimer);
      this.uiPushTimer = null;
    }

    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }

    await new Promise<void>((resolve, reject) => {
      this.httpServer.close((error?: Error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  }

  public getUiUrl(): string {
    return `http://localhost:${this.uiPort}`;
  }

  public getAgentListenUrl(): string {
    return `ws://${this.host}:${this.uiPort}${this.agentWsPath}`;
  }

  private async rollbackAfterUiDisconnect(): Promise<void> {
    const selectedAgentId = this.session.selectedAgentId;
    if (!selectedAgentId) {
      return;
    }

    try {
      await this.agentChannel.requestSetStreaming(selectedAgentId, false);
      await this.agentChannel.requestRestoreBaseline(selectedAgentId, { scope: 'all' });
    } catch (error) {
      this.uiChannel.broadcastEvent('ui.warning', {
        code: 'ROLLBACK_FAILED',
        message: error instanceof Error ? error.message : 'Failed to rollback on UI disconnect',
      });
    }
  }

  private async pushTreeSnapshotIfAvailable(): Promise<void> {
    const selectedAgentId = this.session.selectedAgentId;
    const selectedTreeKey = this.session.selectedTreeKey;
    if (!selectedAgentId || !selectedTreeKey) {
      return;
    }

    try {
      const result = await this.agentChannel.requestTreeSnapshot(selectedAgentId, selectedTreeKey) as { tree?: unknown };
      const tree = result.tree;
      if (tree) {
        this.latestTreeSnapshots.set(makeStreamKey(selectedAgentId, selectedTreeKey), tree);
        this.uiChannel.broadcastEvent('ui.treeSnapshot', { treeKey: selectedTreeKey, tree });
      }
      await this.agentChannel.requestSetStreaming(selectedAgentId, true);
    } catch (error) {
      this.uiChannel.broadcastEvent('ui.warning', {
        code: 'TREE_SNAPSHOT_FAILED',
        message: error instanceof Error ? error.message : 'Could not fetch tree snapshot',
      });
    }
  }

  private flushTicksToUi(): void {
    const selectedAgentId = this.session.selectedAgentId;
    const selectedTreeKey = this.session.selectedTreeKey;
    if (!selectedAgentId || !selectedTreeKey) {
      return;
    }

    const streamKey = makeStreamKey(selectedAgentId, selectedTreeKey);
    const ticks = this.tickBuffer.drainPending(streamKey);
    if (ticks.length === 0) {
      return;
    }

    this.uiChannel.broadcastEvent('ui.tickBatch', {
      treeKey: selectedTreeKey,
      ticks,
    });
  }

  private createUiSessionState(): {
    mode: 'listen' | 'connect';
    selectedAgentId: string | null;
    selectedTreeKey: string | null;
    agents: Array<{ id: string; name: string; state: string }>;
    trees: AgentTreeInfo[];
    lastSnapshot?: unknown;
    bufferedTicks?: TickRecord[];
  } {
    const selectedAgentId = this.session.selectedAgentId;
    const selectedTreeKey = this.session.selectedTreeKey;
    const trees = selectedAgentId ? this.agentChannel.getAgentTrees(selectedAgentId) : [];
    const streamKey = selectedAgentId && selectedTreeKey ? makeStreamKey(selectedAgentId, selectedTreeKey) : null;

    return {
      mode: this.session.mode,
      selectedAgentId,
      selectedTreeKey,
      agents: this.agentChannel.getAgentSnapshotList().map((agent) => ({
        id: agent.id,
        name: agent.name,
        state: agent.state,
      })),
      trees,
      lastSnapshot: streamKey ? this.latestTreeSnapshots.get(streamKey) : undefined,
      bufferedTicks: streamKey ? this.tickBuffer.getHistory(streamKey) : [],
    };
  }

  private handleUiSocket(ws: WebSocket): void {
    const clientId = this.uiChannel.attachSocket(ws);
    this.uiChannel.updateHeartbeat(clientId, Date.now());
    this.uiChannel.sendEvent(clientId, 'ui.sessionState', this.createUiSessionState());
  }

  private handleHttpRequest(request: IncomingMessage, response: ServerResponse): void {
    const pathname = this.getRequestPathname(request);

    if (pathname === '/api/health') {
      response.statusCode = 200;
      response.setHeader('content-type', 'application/json');
      response.end(JSON.stringify({ ok: true }));
      return;
    }

    if (pathname.startsWith('/api/')) {
      response.statusCode = 404;
      response.end('Not found');
      return;
    }

    const normalizedPath = pathname === '/' ? '/index.html' : pathname;
    const candidate = normalize(join(this.staticDir, normalizedPath));
    const staticRoot = normalize(this.staticDir);

    if (!candidate.startsWith(staticRoot)) {
      response.statusCode = 403;
      response.end('Forbidden');
      return;
    }

    let filePath = candidate;
    if (!existsSync(filePath) || !statSync(filePath).isFile()) {
      filePath = join(this.staticDir, 'index.html');
    }

    if (!existsSync(filePath)) {
      response.statusCode = 404;
      response.end('Studio UI not found. Build UI with `yarn workspace @behavior-tree-ist/studio run build:ui`.');
      return;
    }

    const content = readFileSync(filePath);
    response.statusCode = 200;
    response.setHeader('content-type', this.getMimeType(filePath));
    response.end(content);
  }

  private getRequestPathname(request: IncomingMessage): string {
    const host = request.headers.host ?? `localhost:${this.uiPort}`;
    const url = new URL(request.url ?? '/', `http://${host}`);
    return url.pathname;
  }

  private getMimeType(filePath: string): string {
    if (filePath.endsWith('.html')) return 'text/html; charset=utf-8';
    if (filePath.endsWith('.js')) return 'application/javascript; charset=utf-8';
    if (filePath.endsWith('.css')) return 'text/css; charset=utf-8';
    if (filePath.endsWith('.json')) return 'application/json; charset=utf-8';
    if (filePath.endsWith('.svg')) return 'image/svg+xml';
    if (filePath.endsWith('.png')) return 'image/png';
    return 'application/octet-stream';
  }
}
