import { describe, it, expect } from "vitest";
import { encodeFrame, encodeStringFrame, FrameDecoder } from "./length-framing";

describe("encodeFrame", () => {
    it("should prepend a 4-byte big-endian length header", () => {
        const payload = new Uint8Array([0x01, 0x02, 0x03]);
        const frame = encodeFrame(payload);

        expect(frame.byteLength).toBe(4 + 3);
        // Header: big-endian uint32 = 3
        expect(frame[0]).toBe(0);
        expect(frame[1]).toBe(0);
        expect(frame[2]).toBe(0);
        expect(frame[3]).toBe(3);
        // Payload
        expect(frame[4]).toBe(0x01);
        expect(frame[5]).toBe(0x02);
        expect(frame[6]).toBe(0x03);
    });

    it("should handle empty payload", () => {
        const frame = encodeFrame(new Uint8Array(0));
        expect(frame.byteLength).toBe(4);
        const view = new DataView(frame.buffer);
        expect(view.getUint32(0, false)).toBe(0);
    });

    it("should handle large payload", () => {
        const payload = new Uint8Array(1024);
        payload.fill(0xab);
        const frame = encodeFrame(payload);
        expect(frame.byteLength).toBe(4 + 1024);
        const view = new DataView(frame.buffer);
        expect(view.getUint32(0, false)).toBe(1024);
    });
});

describe("encodeStringFrame", () => {
    it("should encode a string as UTF-8 with length header", () => {
        const frame = encodeStringFrame("hello");
        expect(frame.byteLength).toBe(4 + 5); // "hello" = 5 bytes in UTF-8
        const view = new DataView(frame.buffer);
        expect(view.getUint32(0, false)).toBe(5);

        const decoder = new TextDecoder();
        expect(decoder.decode(frame.slice(4))).toBe("hello");
    });

    it("should handle multi-byte UTF-8 characters", () => {
        const frame = encodeStringFrame("héllo");
        const encoder = new TextEncoder();
        const expected = encoder.encode("héllo");
        expect(frame.byteLength).toBe(4 + expected.byteLength);
    });

    it("should handle empty string", () => {
        const frame = encodeStringFrame("");
        expect(frame.byteLength).toBe(4);
        const view = new DataView(frame.buffer);
        expect(view.getUint32(0, false)).toBe(0);
    });
});

describe("FrameDecoder", () => {
    it("should decode a single complete frame", () => {
        const received: Uint8Array[] = [];
        const decoder = new FrameDecoder((payload) => received.push(payload));

        const frame = encodeFrame(new Uint8Array([1, 2, 3]));
        decoder.feed(frame);

        expect(received).toHaveLength(1);
        expect(Array.from(received[0])).toEqual([1, 2, 3]);
    });

    it("should decode multiple frames in a single chunk", () => {
        const received: Uint8Array[] = [];
        const decoder = new FrameDecoder((payload) => received.push(payload));

        const frame1 = encodeFrame(new Uint8Array([0x0a]));
        const frame2 = encodeFrame(new Uint8Array([0x0b, 0x0c]));
        const combined = new Uint8Array(frame1.byteLength + frame2.byteLength);
        combined.set(frame1, 0);
        combined.set(frame2, frame1.byteLength);

        decoder.feed(combined);

        expect(received).toHaveLength(2);
        expect(Array.from(received[0])).toEqual([0x0a]);
        expect(Array.from(received[1])).toEqual([0x0b, 0x0c]);
    });

    it("should handle partial header", () => {
        const received: Uint8Array[] = [];
        const decoder = new FrameDecoder((payload) => received.push(payload));

        const frame = encodeFrame(new Uint8Array([1, 2, 3]));

        // Feed only 2 bytes of the header
        decoder.feed(frame.slice(0, 2));
        expect(received).toHaveLength(0);

        // Feed the rest
        decoder.feed(frame.slice(2));
        expect(received).toHaveLength(1);
        expect(Array.from(received[0])).toEqual([1, 2, 3]);
    });

    it("should handle partial payload", () => {
        const received: Uint8Array[] = [];
        const decoder = new FrameDecoder((payload) => received.push(payload));

        const frame = encodeFrame(new Uint8Array([1, 2, 3, 4, 5]));

        // Feed header + partial payload
        decoder.feed(frame.slice(0, 6)); // 4 header + 2 payload bytes
        expect(received).toHaveLength(0);

        // Feed the rest
        decoder.feed(frame.slice(6));
        expect(received).toHaveLength(1);
        expect(Array.from(received[0])).toEqual([1, 2, 3, 4, 5]);
    });

    it("should handle frame split across many chunks (byte by byte)", () => {
        const received: Uint8Array[] = [];
        const decoder = new FrameDecoder((payload) => received.push(payload));

        const frame = encodeFrame(new Uint8Array([0xaa, 0xbb]));

        for (let i = 0; i < frame.byteLength; i++) {
            decoder.feed(frame.slice(i, i + 1));
        }

        expect(received).toHaveLength(1);
        expect(Array.from(received[0])).toEqual([0xaa, 0xbb]);
    });

    it("should handle interleaved partial and complete frames", () => {
        const received: Uint8Array[] = [];
        const decoder = new FrameDecoder((payload) => received.push(payload));

        const frame1 = encodeFrame(new Uint8Array([1]));
        const frame2 = encodeFrame(new Uint8Array([2, 3]));
        const frame3 = encodeFrame(new Uint8Array([4, 5, 6]));

        // Feed all of frame1 + half of frame2
        const chunk1 = new Uint8Array(frame1.byteLength + 3);
        chunk1.set(frame1, 0);
        chunk1.set(frame2.slice(0, 3), frame1.byteLength);
        decoder.feed(chunk1);
        expect(received).toHaveLength(1);

        // Feed rest of frame2 + all of frame3
        const chunk2 = new Uint8Array(
            frame2.byteLength - 3 + frame3.byteLength
        );
        chunk2.set(frame2.slice(3), 0);
        chunk2.set(frame3, frame2.byteLength - 3);
        decoder.feed(chunk2);
        expect(received).toHaveLength(3);

        expect(Array.from(received[0])).toEqual([1]);
        expect(Array.from(received[1])).toEqual([2, 3]);
        expect(Array.from(received[2])).toEqual([4, 5, 6]);
    });

    it("should decode empty frames", () => {
        const received: Uint8Array[] = [];
        const decoder = new FrameDecoder((payload) => received.push(payload));

        const frame = encodeFrame(new Uint8Array(0));
        decoder.feed(frame);

        expect(received).toHaveLength(1);
        expect(received[0].byteLength).toBe(0);
    });

    it("should reset internal buffer", () => {
        const received: Uint8Array[] = [];
        const decoder = new FrameDecoder((payload) => received.push(payload));

        const frame = encodeFrame(new Uint8Array([1, 2, 3]));

        // Feed partial data
        decoder.feed(frame.slice(0, 3));
        expect(received).toHaveLength(0);

        // Reset and feed a complete new frame
        decoder.reset();
        const frame2 = encodeFrame(new Uint8Array([9]));
        decoder.feed(frame2);
        expect(received).toHaveLength(1);
        expect(Array.from(received[0])).toEqual([9]);
    });

    it("should roundtrip string data", () => {
        const received: string[] = [];
        const decoder = new FrameDecoder((payload) => {
            received.push(new TextDecoder().decode(payload));
        });

        const messages = ["hello", "world", "café", "日本語"];
        for (const msg of messages) {
            decoder.feed(encodeStringFrame(msg));
        }

        expect(received).toEqual(messages);
    });

    it("should decode a single frame exceeding initial buffer capacity", () => {
        const received: Uint8Array[] = [];
        const decoder = new FrameDecoder((payload) => received.push(payload));

        const payload = new Uint8Array(5000);
        payload.fill(0xcd);
        decoder.feed(encodeFrame(payload));

        expect(received).toHaveLength(1);
        expect(received[0].byteLength).toBe(5000);
        expect(received[0].every((b) => b === 0xcd)).toBe(true);
    });

    it("should handle many sequential frames (stress: compaction + growth)", () => {
        const received: Uint8Array[] = [];
        const decoder = new FrameDecoder((payload) => received.push(payload));

        const count = 150;
        for (let i = 0; i < count; i++) {
            const payload = new Uint8Array([i % 256]);
            decoder.feed(encodeFrame(payload));
        }

        expect(received).toHaveLength(count);
        for (let i = 0; i < count; i++) {
            expect(received[i][0]).toBe(i % 256);
        }
    });

    it("should decode a large frame split across multiple chunks", () => {
        const received: Uint8Array[] = [];
        const decoder = new FrameDecoder((payload) => received.push(payload));

        const payload = new Uint8Array(8000);
        for (let i = 0; i < 8000; i++) payload[i] = i % 256;
        const frame = encodeFrame(payload);

        // Split into 4 unequal chunks
        const splits = [1000, 3500, 7000, frame.byteLength];
        let prev = 0;
        for (const end of splits) {
            decoder.feed(frame.slice(prev, end));
            prev = end;
        }

        expect(received).toHaveLength(1);
        expect(received[0].byteLength).toBe(8000);
        expect(Array.from(received[0])).toEqual(Array.from(payload));
    });
});
