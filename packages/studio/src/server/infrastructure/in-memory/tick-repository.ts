import { TickRepository, ServerSettings } from "../../domain";
import { TickRecord } from "@behavior-tree-ist/core";

export class InMemoryTickRepository implements TickRepository {
    // map key: `${clientId}:${treeId}`
    private readonly ticks = new Map<string, TickRecord[]>();

    constructor(private readonly getSettings: () => ServerSettings) { }

    private getKey(clientId: string, treeId: string): string {
        return `${clientId}:${treeId}`;
    }

    push(clientId: string, treeId: string, records: TickRecord[]): void {
        if (!records.length) return;

        const key = this.getKey(clientId, treeId);
        const existing = this.ticks.get(key) ?? [];
        const limit = this.getSettings().maxTickRecordsPerTree;

        existing.push(...records);

        if (existing.length > limit) {
            existing.splice(0, existing.length - limit);
        }

        this.ticks.set(key, existing);
    }

    query(clientId: string, treeId: string, afterTickId?: number, limit?: number): TickRecord[] {
        const key = this.getKey(clientId, treeId);
        const existing = this.ticks.get(key) ?? [];

        let result = existing;
        if (afterTickId !== undefined) {
            result = result.filter(t => t.tickId > afterTickId);
        }

        if (limit !== undefined && limit > 0) {
            // Take the most recent `limit` records
            result = result.slice(-limit);
        }

        return result;
    }

    clearByTree(clientId: string, treeId: string): void {
        this.ticks.delete(this.getKey(clientId, treeId));
    }

    clearByClient(clientId: string): void {
        const keysToDelete: string[] = [];
        for (const key of this.ticks.keys()) {
            if (key.startsWith(`${clientId}:`)) {
                keysToDelete.push(key);
            }
        }
        for (const key of keysToDelete) {
            this.ticks.delete(key);
        }
    }
}
