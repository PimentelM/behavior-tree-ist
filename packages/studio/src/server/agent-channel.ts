import { randomUUID } from 'node:crypto';
import { WebSocket } from 'ws';
import type { RawData } from 'ws';
import type { AgentSetCaptureParams, AgentTreeInfo } from '@behavior-tree-ist/core/studio';
import { AgentEventSchema, AgentResponseSchema, safeJsonParse } from './protocol';
import type { AgentSnapshot } from './session-store';

type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
};

type ConnectedAgent = {
  id: string;
  name: string;
  trees: AgentTreeInfo[];
  socket: WebSocket;
  pending: Map<string, PendingRequest>;
  requestSeq: number;
  source: 'listen' | 'connect';
};

function socketPayloadToString(data: RawData): string {
  if (typeof data === 'string') {
    return data;
  }

  if (data instanceof ArrayBuffer) {
    return Buffer.from(data).toString('utf8');
  }

  if (Array.isArray(data)) {
    return Buffer.concat(data.map((chunk) => Buffer.from(chunk))).toString('utf8');
  }

  return data.toString('utf8');
}

export class AgentChannel {
  private readonly agents = new Map<string, ConnectedAgent>();
  private readonly onAgentsChangedHandlers = new Set<() => void>();
  private readonly onTickBatchHandlers = new Set<(payload: { agentId: string; treeKey: string; ticks: unknown[]; droppedSinceLast: number }) => void>();
  private readonly onTreeUpdatedHandlers = new Set<(payload: { agentId: string; treeKey: string; tree: unknown }) => void>();
  private readonly onWarningHandlers = new Set<(payload: { agentId: string; code: string; message: string }) => void>();

  public attachSocket(socket: WebSocket, source: 'listen' | 'connect'): string {
    const agentId = randomUUID();
    const agent: ConnectedAgent = {
      id: agentId,
      name: `Agent ${agentId.slice(0, 8)}`,
      trees: [],
      socket,
      pending: new Map(),
      requestSeq: 1,
      source,
    };

    this.agents.set(agentId, agent);

    socket.on('message', (raw: RawData) => {
      this.handleMessage(agentId, socketPayloadToString(raw));
    });

    socket.on('close', () => {
      this.handleDisconnected(agentId);
    });

    socket.on('error', (error: Error) => {
      this.emitWarning({
        agentId,
        code: 'AGENT_SOCKET_ERROR',
        message: error.message,
      });
    });

    this.emitAgentsChanged();
    return agentId;
  }

  public connectToUrl(url: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const socket = new WebSocket(url);
      socket.once('open', () => {
        const id = this.attachSocket(socket, 'connect');
        resolve(id);
      });
      socket.once('error', (error: Error) => {
        reject(error);
      });
    });
  }

  public getAgentSnapshotList(): AgentSnapshot[] {
    return [...this.agents.values()].map((agent) => ({
      id: agent.id,
      name: agent.name,
      state: agent.socket.readyState === WebSocket.OPEN ? 'connected' : 'disconnected',
      trees: agent.trees,
    }));
  }

  public getAgentTrees(agentId: string): AgentTreeInfo[] {
    return this.agents.get(agentId)?.trees ?? [];
  }

  public onAgentsChanged(handler: () => void): () => void {
    this.onAgentsChangedHandlers.add(handler);
    return () => {
      this.onAgentsChangedHandlers.delete(handler);
    };
  }

  public onTickBatch(handler: (payload: { agentId: string; treeKey: string; ticks: unknown[]; droppedSinceLast: number }) => void): () => void {
    this.onTickBatchHandlers.add(handler);
    return () => {
      this.onTickBatchHandlers.delete(handler);
    };
  }

  public onTreeUpdated(handler: (payload: { agentId: string; treeKey: string; tree: unknown }) => void): () => void {
    this.onTreeUpdatedHandlers.add(handler);
    return () => {
      this.onTreeUpdatedHandlers.delete(handler);
    };
  }

  public onWarning(handler: (payload: { agentId: string; code: string; message: string }) => void): () => void {
    this.onWarningHandlers.add(handler);
    return () => {
      this.onWarningHandlers.delete(handler);
    };
  }

  public async requestTreeSnapshot(agentId: string, treeKey: string): Promise<unknown> {
    return this.sendRequest(agentId, 'agent.getTree', { treeKey });
  }

  public async requestSetCapture(agentId: string, params: AgentSetCaptureParams): Promise<void> {
    await this.sendRequest(agentId, 'agent.setCapture', params);
  }

  public async requestSetStreaming(agentId: string, enabled: boolean): Promise<void> {
    await this.sendRequest(agentId, 'agent.setStreaming', { enabled });
  }

  public async requestRestoreBaseline(agentId: string, params: { scope: 'tree' | 'all'; treeKey?: string }): Promise<void> {
    await this.sendRequest(agentId, 'agent.restoreBaseline', params);
  }

  public closeAll(reason = 'Server shutdown'): void {
    for (const agent of this.agents.values()) {
      for (const pending of agent.pending.values()) {
        pending.reject(new Error(reason));
      }
      agent.pending.clear();
      if (agent.socket.readyState === WebSocket.OPEN || agent.socket.readyState === WebSocket.CONNECTING) {
        agent.socket.close(1001, reason);
      }
    }
    this.agents.clear();
    this.emitAgentsChanged();
  }

  private sendRequest(agentId: string, method: string, params?: unknown): Promise<unknown> {
    const agent = this.agents.get(agentId);
    if (!agent) {
      return Promise.reject(new Error(`Unknown agent: ${agentId}`));
    }

    if (agent.socket.readyState !== WebSocket.OPEN) {
      return Promise.reject(new Error(`Agent socket is not open: ${agentId}`));
    }

    const id = `${agent.id}:${agent.requestSeq++}`;
    const payload = {
      v: 1,
      kind: 'req',
      id,
      method,
      params,
    };

    return new Promise((resolve, reject) => {
      agent.pending.set(id, { resolve, reject });
      agent.socket.send(JSON.stringify(payload), (error?: Error) => {
        if (!error) {
          return;
        }
        agent.pending.delete(id);
        reject(error);
      });
    });
  }

  private handleMessage(agentId: string, payload: string): void {
    const parsed = safeJsonParse(payload);
    if (!parsed) {
      return;
    }

    const eventResult = AgentEventSchema.safeParse(parsed);
    if (eventResult.success) {
      this.handleAgentEvent(agentId, eventResult.data);
      return;
    }

    const responseResult = AgentResponseSchema.safeParse(parsed);
    if (responseResult.success) {
      this.handleAgentResponse(agentId, responseResult.data);
    }
  }

  private handleAgentEvent(agentId: string, frame: ReturnType<typeof AgentEventSchema.parse>): void {
    const agent = this.agents.get(agentId);
    if (!agent) {
      return;
    }

    switch (frame.event) {
      case 'agent.hello':
        agent.name = frame.data.clientName;
        agent.trees = frame.data.trees;
        this.emitAgentsChanged();
        return;
      case 'agent.treesChanged':
        agent.trees = frame.data.trees;
        this.emitAgentsChanged();
        return;
      case 'agent.treeUpdated':
        for (const handler of this.onTreeUpdatedHandlers) {
          handler({ agentId, treeKey: frame.data.treeKey, tree: frame.data.tree });
        }
        return;
      case 'agent.tickBatch':
        for (const handler of this.onTickBatchHandlers) {
          handler({
            agentId,
            treeKey: frame.data.treeKey,
            ticks: frame.data.ticks,
            droppedSinceLast: frame.data.droppedSinceLast,
          });
        }
        return;
      case 'agent.warning':
        this.emitWarning({
          agentId,
          code: frame.data.code,
          message: frame.data.message,
        });
        return;
      case 'agent.heartbeat':
        return;
    }
  }

  private handleAgentResponse(agentId: string, frame: ReturnType<typeof AgentResponseSchema.parse>): void {
    const agent = this.agents.get(agentId);
    if (!agent) {
      return;
    }

    const pending = agent.pending.get(frame.id);
    if (!pending) {
      return;
    }

    agent.pending.delete(frame.id);
    if (frame.ok) {
      pending.resolve(frame.result);
    } else {
      pending.reject(new Error(frame.error.message));
    }
  }

  private handleDisconnected(agentId: string): void {
    const agent = this.agents.get(agentId);
    if (!agent) {
      return;
    }

    for (const pending of agent.pending.values()) {
      pending.reject(new Error('Agent disconnected'));
    }

    this.agents.delete(agentId);
    this.emitAgentsChanged();
  }

  private emitAgentsChanged(): void {
    for (const handler of this.onAgentsChangedHandlers) {
      handler();
    }
  }

  private emitWarning(payload: { agentId: string; code: string; message: string }): void {
    for (const handler of this.onWarningHandlers) {
      handler(payload);
    }
  }
}
