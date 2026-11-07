import { Snapshot } from "./types";
import { decodeBody } from "./decode";

interface PartialFrame {
  sequence: number;
  count: number;
  next: number;
  capacity: number;
  chunks: Uint8Array[];
}
export class Assembler {
  private partial: PartialFrame | null = null;
  private sequence: number | null = null;
  private lastNotification: number | null = null;

  push(bytes: Uint8Array, now: number): Snapshot | null {
    this.tick(now);
    this.lastNotification = now; // Even malformed notifications interrupt the inactivity timer.
    if (
      bytes.length < 6 ||
      bytes.length > 244 ||
      bytes[0] !== 1 ||
      bytes[4]! < 1 ||
      bytes[4]! > 15 ||
      bytes[3]! >= bytes[4]!
    ) {
      this.partial = null;
      return null;
    }
    const seq = bytes[1]! | (bytes[2]! << 8),
      index = bytes[3]!,
      count = bytes[4]!;
    const payload = bytes.slice(5);
    if (index === 0) {
      if (this.sequence !== null) {
        const distance = (seq - this.sequence) & 0xffff;
        if (distance === 0 || distance >= 32768) return null;
      }
      this.sequence = seq;
      this.partial = {
        sequence: seq,
        count,
        next: 0,
        capacity: payload.length,
        chunks: [],
      };
    }
    const frame = this.partial;
    if (
      !frame ||
      seq !== frame.sequence ||
      count !== frame.count ||
      index !== frame.next ||
      (index < count - 1
        ? payload.length !== frame.capacity
        : payload.length > frame.capacity)
    ) {
      this.partial = null;
      return null;
    }
    frame.chunks.push(payload);
    frame.next++;
    if (frame.next !== count) return null;
    this.partial = null;
    const size = frame.chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    if (size !== 219) return null;
    const body = new Uint8Array(size);
    let offset = 0;
    for (const chunk of frame.chunks) {
      body.set(chunk, offset);
      offset += chunk.length;
    }
    return decodeBody(body, seq, now);
  }
  tick(now: number): void {
    if (this.lastNotification !== null && now - this.lastNotification >= 1000)
      this.reset();
  }
  reset(): void {
    this.partial = null;
    this.sequence = null;
    this.lastNotification = null;
  }
}
