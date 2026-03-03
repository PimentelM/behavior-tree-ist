const HEADER_SIZE = 4

export const encodeFrame = (payload: Uint8Array): Uint8Array => {
  const frame = new Uint8Array(HEADER_SIZE + payload.byteLength)
  const view = new DataView(frame.buffer)
  view.setUint32(0, payload.byteLength, false)
  frame.set(payload, HEADER_SIZE)
  return frame
}

export const encodeStringFrame = (payload: string): Uint8Array =>
  encodeFrame(new TextEncoder().encode(payload))

export class FrameDecoder {
  private buffered = new Uint8Array(0)

  constructor(private readonly onFrame: (payload: Uint8Array) => void) {}

  feed(chunk: Uint8Array): void {
    const nextBuffer = new Uint8Array(this.buffered.byteLength + chunk.byteLength)
    nextBuffer.set(this.buffered, 0)
    nextBuffer.set(chunk, this.buffered.byteLength)
    this.buffered = nextBuffer

    while (this.buffered.byteLength >= HEADER_SIZE) {
      const view = new DataView(
        this.buffered.buffer,
        this.buffered.byteOffset,
        this.buffered.byteLength,
      )
      const payloadSize = view.getUint32(0, false)
      const frameSize = HEADER_SIZE + payloadSize
      if (this.buffered.byteLength < frameSize) {
        return
      }

      const payload = this.buffered.slice(HEADER_SIZE, frameSize)
      this.buffered = this.buffered.slice(frameSize)
      this.onFrame(payload)
    }
  }

  reset(): void {
    this.buffered = new Uint8Array(0)
  }
}
