export class RingBuffer<T> {
    private readonly buffer: (T | undefined)[];
    private head = 0;
    private count = 0;

    constructor(private readonly capacity: number) {
        if (capacity <= 0) throw new Error("Capacity must be positive");
        this.buffer = new Array(capacity).fill(undefined);
    }

    push(item: T): void {
        this.buffer[(this.head + this.count) % this.capacity] = item;
        if (this.count < this.capacity) {
            this.count++;
        } else {
            this.head = (this.head + 1) % this.capacity;
        }
    }

    peekFirst(): T | undefined {
        if (this.count === 0) return undefined;
        return this.buffer[this.head];
    }

    peekLast(): T | undefined {
        if (this.count === 0) return undefined;
        return this.buffer[(this.head + this.count - 1) % this.capacity];
    }

    get size(): number {
        return this.count;
    }

    forEach(callback: (item: T) => void): void {
        for (let i = 0; i < this.count; i++) {
            callback(this.buffer[(this.head + i) % this.capacity] as T);
        }
    }

    clear(): void {
        this.head = 0;
        this.count = 0;
        this.buffer.fill(undefined);
    }
}
