import { randomUUID } from 'node:crypto';
import { WebSocket } from 'ws';
import type { RawData } from 'ws';
import { UiRequestSchema, safeJsonParse } from './protocol';

type UiClient = {
  id: string;
  socket: WebSocket;
  lastHeartbeatAt: number;
};

export type UiRequest = ReturnType<typeof UiRequestSchema.parse>;

export class UiChannel {
  private readonly clients = new Map<string, UiClient>();
  private readonly requestHandlers = new Set<(clientId: string, request: UiRequest) => Promise<unknown> | unknown>();

  public attachSocket(socket: WebSocket): string {
    const id = randomUUID();
    const client: UiClient = {
      id,
      socket,
      lastHeartbeatAt: Date.now(),
    };
    this.clients.set(id, client);

    socket.on('message', (raw: RawData) => {
      const payload = typeof raw === 'string' ? raw : raw.toString();
      const parsed = safeJsonParse(payload);
      const validated = UiRequestSchema.safeParse(parsed);
      if (!validated.success) {
        return;
      }
      this.handleRequest(client.id, validated.data);
    });

    socket.on('close', () => {
      this.clients.delete(id);
    });

    return id;
  }

  public onRequest(handler: (clientId: string, request: UiRequest) => Promise<unknown> | unknown): () => void {
    this.requestHandlers.add(handler);
    return () => {
      this.requestHandlers.delete(handler);
    };
  }

  public updateHeartbeat(clientId: string, at = Date.now()): void {
    const client = this.clients.get(clientId);
    if (!client) {
      return;
    }
    client.lastHeartbeatAt = at;
  }

  public disconnectStale(maxInactivityMs: number, at = Date.now()): string[] {
    const disconnected: string[] = [];
    for (const [id, client] of this.clients) {
      if (at - client.lastHeartbeatAt <= maxInactivityMs) {
        continue;
      }
      disconnected.push(id);
      client.socket.close(4001, 'Heartbeat timeout');
      this.clients.delete(id);
    }
    return disconnected;
  }

  public getClientCount(): number {
    return this.clients.size;
  }

  public broadcastEvent(event: string, data?: unknown): void {
    const payload = JSON.stringify({
      v: 1,
      kind: 'evt',
      event,
      data,
    });

    for (const client of this.clients.values()) {
      if (client.socket.readyState !== WebSocket.OPEN) {
        continue;
      }
      client.socket.send(payload);
    }
  }

  public sendEvent(clientId: string, event: string, data?: unknown): void {
    const client = this.clients.get(clientId);
    if (!client || client.socket.readyState !== WebSocket.OPEN) {
      return;
    }

    client.socket.send(JSON.stringify({
      v: 1,
      kind: 'evt',
      event,
      data,
    }));
  }

  public closeAll(reason = 'Server shutdown'): void {
    for (const [id, client] of this.clients) {
      if (client.socket.readyState === WebSocket.OPEN || client.socket.readyState === WebSocket.CONNECTING) {
        client.socket.close(1001, reason);
      }
      this.clients.delete(id);
    }
  }

  private async handleRequest(clientId: string, request: UiRequest): Promise<void> {
    for (const handler of this.requestHandlers) {
      try {
        const result = await handler(clientId, request);
        this.sendResponse(clientId, request.id, result);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown ui request error';
        this.sendError(clientId, request.id, 'UI_REQUEST_FAILED', message);
      }
      return;
    }

    this.sendError(clientId, request.id, 'NO_REQUEST_HANDLER', 'No request handler registered');
  }

  private sendResponse(clientId: string, id: string, result?: unknown): void {
    const client = this.clients.get(clientId);
    if (!client || client.socket.readyState !== WebSocket.OPEN) {
      return;
    }
    client.socket.send(JSON.stringify({
      v: 1,
      kind: 'res',
      id,
      ok: true,
      result,
    }));
  }

  private sendError(clientId: string, id: string, code: string, message: string): void {
    const client = this.clients.get(clientId);
    if (!client || client.socket.readyState !== WebSocket.OPEN) {
      return;
    }
    client.socket.send(JSON.stringify({
      v: 1,
      kind: 'res',
      id,
      ok: false,
      error: {
        code,
        message,
      },
    }));
  }
}
