/**
 * Length-based framing for TCP transports.
 *
 * Each frame is prefixed with a 4-byte big-endian uint32 length header,
 * followed by the payload bytes. The decoder handles partial reads and
 * multiple frames arriving in a single chunk.
 */

const HEADER_SIZE = 4;

/**
 * Encodes a payload into a length-prefixed frame.
 */
export function encodeFrame(data: Uint8Array): Uint8Array {
    const frame = new Uint8Array(HEADER_SIZE + data.byteLength);
    const view = new DataView(frame.buffer);
    view.setUint32(0, data.byteLength, false); // big-endian
    frame.set(data, HEADER_SIZE);
    return frame;
}

/**
 * Encodes a string payload into a length-prefixed frame (UTF-8).
 */
export function encodeStringFrame(data: string): Uint8Array {
    const encoder = new TextEncoder();
    const encoded = encoder.encode(data);
    return encodeFrame(encoded);
}

const INITIAL_CAPACITY = 4096;

/**
 * Stateful frame decoder that buffers incoming data and emits
 * complete frames via callback.
 *
 * Uses a growable linear buffer with read-offset tracking to
 * avoid allocating a new Uint8Array on every chunk.
 */
export class FrameDecoder {
    private buffer: Uint8Array = new Uint8Array(INITIAL_CAPACITY);
    private readOffset = 0;
    private writeOffset = 0;

    constructor(private readonly onFrame: (payload: Uint8Array) => void) { }

    /** Number of unconsumed bytes in the buffer. */
    private get available(): number {
        return this.writeOffset - this.readOffset;
    }

    /**
     * Feed raw bytes from the transport into the decoder.
     * Will emit zero or more complete frames via the onFrame callback.
     */
    feed(chunk: Uint8Array): void {
        this.ensureCapacity(chunk.byteLength);
        this.buffer.set(chunk, this.writeOffset);
        this.writeOffset += chunk.byteLength;

        // Extract complete frames
        while (this.available >= HEADER_SIZE) {
            const view = new DataView(
                this.buffer.buffer,
                this.buffer.byteOffset + this.readOffset,
                this.available
            );
            const payloadLength = view.getUint32(0, false); // big-endian
            const frameSize = HEADER_SIZE + payloadLength;

            if (this.available < frameSize) {
                break; // Not enough data yet
            }

            // slice() — caller owns the payload copy
            const payload = this.buffer.slice(
                this.readOffset + HEADER_SIZE,
                this.readOffset + frameSize
            );
            this.readOffset += frameSize;
            this.onFrame(payload);
        }

        // Compact when read offset exceeds 50% of buffer length
        if (this.readOffset > this.buffer.byteLength * 0.5) {
            this.compact();
        }
    }

    /**
     * Reset internal buffer state.
     */
    reset(): void {
        this.readOffset = 0;
        this.writeOffset = 0;
    }

    /** Ensure the buffer has room for `extra` more bytes after writeOffset. */
    private ensureCapacity(extra: number): void {
        const needed = this.writeOffset + extra;
        if (needed <= this.buffer.byteLength) return;

        // Grow to at least double current size or needed, whichever is larger
        let newSize = this.buffer.byteLength * 2;
        if (newSize < needed) newSize = needed;

        const grown = new Uint8Array(newSize);
        // Only copy unconsumed data
        grown.set(this.buffer.subarray(this.readOffset, this.writeOffset), 0);
        this.writeOffset = this.available;
        this.readOffset = 0;
        this.buffer = grown;
    }

    /** Shift unconsumed data to the start of the buffer. */
    private compact(): void {
        const remaining = this.available;
        if (remaining > 0) {
            this.buffer.copyWithin(0, this.readOffset, this.writeOffset);
        }
        this.readOffset = 0;
        this.writeOffset = remaining;
    }
}
