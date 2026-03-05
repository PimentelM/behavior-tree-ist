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

/**
 * Stateful frame decoder that buffers incoming data and emits
 * complete frames via callback.
 */
export class FrameDecoder {
    private buffer: Uint8Array = new Uint8Array(0);

    constructor(private readonly onFrame: (payload: Uint8Array) => void) { }

    /**
     * Feed raw bytes from the transport into the decoder.
     * Will emit zero or more complete frames via the onFrame callback.
     */
    feed(chunk: Uint8Array): void {
        // Append chunk to buffer
        const newBuffer = new Uint8Array(this.buffer.byteLength + chunk.byteLength);
        newBuffer.set(this.buffer, 0);
        newBuffer.set(chunk, this.buffer.byteLength);
        this.buffer = newBuffer;

        // Extract complete frames
        while (this.buffer.byteLength >= HEADER_SIZE) {
            const view = new DataView(
                this.buffer.buffer,
                this.buffer.byteOffset,
                this.buffer.byteLength
            );
            const payloadLength = view.getUint32(0, false); // big-endian
            const frameSize = HEADER_SIZE + payloadLength;

            if (this.buffer.byteLength < frameSize) {
                break; // Not enough data yet
            }

            const payload = this.buffer.slice(HEADER_SIZE, frameSize);
            this.buffer = this.buffer.slice(frameSize);
            this.onFrame(payload);
        }
    }

    /**
     * Reset internal buffer state.
     */
    reset(): void {
        this.buffer = new Uint8Array(0);
    }
}
