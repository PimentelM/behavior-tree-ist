export class RingBuffer<T> {
    private readonly buffer: (T | undefined)[];
    private head = 0;
    private count = 0;

    constructor(private readonly capacity: number) {
        if (capacity <= 0) throw new Error("Capacity must be positive");
        this.buffer = new Array<T | undefined>(capacity).fill(undefined);
    }

    push(item: T): void {
        this.buffer[(this.head + this.count) % this.capacity] = item;
        if (this.count < this.capacity) {
            this.count++;
        } else {
            this.head = (this.head + 1) % this.capacity;
        }
    }

    pushMany(items: T[]): T[] {
        if (items.length === 0) return [];

        // If items exceed capacity, only the last `capacity` items matter
        if (items.length >= this.capacity) {
            const evicted: T[] = [];
            this.forEach(item => evicted.push(item));
            const start = items.length - this.capacity;
            for (let i = 0; i < this.capacity; i++) {
                this.buffer[i] = items[start + i];
            }
            this.head = 0;
            this.count = this.capacity;
            return evicted;
        }

        const evicted: T[] = [];
        const totalAfter = this.count + items.length;
        const evictCount = Math.max(0, totalAfter - this.capacity);

        for (let i = 0; i < evictCount; i++) {
            evicted.push(this.buffer[(this.head + i) % this.capacity] as T);
        }

        for (const item of items) {
            this.buffer[(this.head + this.count) % this.capacity] = item;
            if (this.count < this.capacity) {
                this.count++;
            } else {
                this.head = (this.head + 1) % this.capacity;
            }
        }

        return evicted;
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

    /**
     * Prepend a single item to the front (oldest end).
     * If the buffer is full, evicts and returns the item from the tail (newest end).
     */
    unshift(item: T): T | undefined {
        let evicted: T | undefined;
        if (this.count === this.capacity) {
            evicted = this.buffer[(this.head + this.count - 1) % this.capacity] as T;
            this.count--;
        }
        this.head = (this.head - 1 + this.capacity) % this.capacity;
        this.buffer[this.head] = item;
        this.count++;
        return evicted;
    }

    /**
     * Prepend multiple items to the front (oldest end), items[0] being the oldest.
     * Evicts from the tail (newest end) when buffer overflows.
     * If items.length >= capacity, all existing items are evicted and only the
     * newest `capacity` items from the input are kept.
     * Returns all evicted items (previously stored items displaced from the tail).
     */
    unshiftMany(items: T[]): T[] {
        if (items.length === 0) return [];

        if (items.length >= this.capacity) {
            const evicted: T[] = [];
            this.forEach(item => evicted.push(item));
            const start = items.length - this.capacity;
            for (let i = 0; i < this.capacity; i++) {
                this.buffer[i] = items[start + i];
            }
            this.head = 0;
            this.count = this.capacity;
            return evicted;
        }

        const evictCount = Math.max(0, this.count + items.length - this.capacity);
        const evicted: T[] = [];

        for (let i = 0; i < evictCount; i++) {
            const tailIdx = (this.head + this.count - 1 - i) % this.capacity;
            evicted.push(this.buffer[tailIdx] as T);
        }
        this.count -= evictCount;

        // Prepend items in oldest-first order: unshift from newest to oldest
        for (let i = items.length - 1; i >= 0; i--) {
            this.head = (this.head - 1 + this.capacity) % this.capacity;
            this.buffer[this.head] = items[i];
            this.count++;
        }

        return evicted;
    }

    clear(): void {
        this.head = 0;
        this.count = 0;
        this.buffer.fill(undefined);
    }
}
