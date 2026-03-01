import type { TickRecord } from '@behavior-tree-ist/core';

export class TickBufferStore {
  private readonly historyByStream = new Map<string, TickRecord[]>();
  private readonly pendingByStream = new Map<string, TickRecord[]>();

  constructor(private readonly maxTicksPerStream: number) {}

  append(streamKey: string, ticks: TickRecord[]): void {
    if (ticks.length === 0) {
      return;
    }

    const history = this.historyByStream.get(streamKey) ?? [];
    history.push(...ticks);
    if (history.length > this.maxTicksPerStream) {
      history.splice(0, history.length - this.maxTicksPerStream);
    }
    this.historyByStream.set(streamKey, history);

    const pending = this.pendingByStream.get(streamKey) ?? [];
    pending.push(...ticks);
    this.pendingByStream.set(streamKey, pending);
  }

  getHistory(streamKey: string): TickRecord[] {
    return [...(this.historyByStream.get(streamKey) ?? [])];
  }

  drainPending(streamKey: string): TickRecord[] {
    const pending = this.pendingByStream.get(streamKey);
    if (!pending || pending.length === 0) {
      return [];
    }
    this.pendingByStream.set(streamKey, []);
    return pending;
  }

  clear(streamKey: string): void {
    this.historyByStream.delete(streamKey);
    this.pendingByStream.delete(streamKey);
  }
}
