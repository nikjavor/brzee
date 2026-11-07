import { Snapshot } from "./types";
export function decodeBody(
  body: Uint8Array,
  sequence: number,
  now: number,
): Snapshot | null {
  if (body.length !== 219 || (body[8]! & 0xf8) !== 0) return null;
  const view = new DataView(body.buffer, body.byteOffset, body.byteLength);
  const readings = Array.from({ length: 35 }, (_, id) =>
    Object.freeze({
      raw: view.getInt32(9 + 6 * id, true),
      valid: Boolean(body[4 + Math.floor(id / 8)]! & (1 << (id % 8))),
      wireAgeMs: view.getUint16(13 + 6 * id, true),
    }),
  );
  return Object.freeze({
    sequence,
    capturedUptimeMs: view.getUint32(0, true),
    receivedMonoMs: now,
    readings: Object.freeze(readings),
  });
}
