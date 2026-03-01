export class OutboundQueue<T> {
    private items: T[] = [];

    constructor(public readonly capacity: number) {
        if (capacity <= 0) {
            throw new Error("Capacity must be greater than 0");
        }
    }

    public push(item: T): void {
        if (this.items.length >= this.capacity) {
            this.items.shift();
        }
        this.items.push(item);
    }

    public drain(): T[] {
        const result = this.items;
        this.items = [];
        return result;
    }

    public get size(): number {
        return this.items.length;
    }
}
