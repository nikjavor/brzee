import { Reading, SignalId, Snapshot } from "../protocol/types";
export const STREAM_TIMEOUT_MS = 1000;
export function effectiveAge(
  reading: Reading,
  received: number,
  now: number,
): { ms: number; lowerBound: boolean } {
  return {
    ms: reading.wireAgeMs + Math.max(0, now - received),
    lowerBound: reading.wireAgeMs === 65535,
  };
}
export function freshnessLimit(id: SignalId): number {
  if (id === 0) return 1500;
  if (id === 16 || id === 19) return 1500;
  if (id === 17 || id === 18) return 2000;
  if (id === 1) return 2500;
  return 5000;
}
export function sampleUptime(snapshot: Snapshot, id: SignalId): number {
  return (snapshot.capturedUptimeMs - snapshot.readings[id]!.wireAgeMs) >>> 0;
}
