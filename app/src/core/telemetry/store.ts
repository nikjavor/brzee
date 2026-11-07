import { PedalId, SignalId, Snapshot, Reading } from "../protocol/types";
import { effectiveAge, freshnessLimit, STREAM_TIMEOUT_MS } from "./freshness";
import { PedalSelector } from "./pedal";
export type ConnectionState =
  | "idle"
  | "scanning"
  | "selecting"
  | "connecting"
  | "subscribing"
  | "waiting"
  | "connected"
  | "disconnected"
  | "error";
export interface TelemetryState {
  connection: ConnectionState;
  snapshot: Snapshot | null;
  selectedPedal: PedalId | null;
  nowMonoMs: number;
}
export class TelemetryStore {
  private state: TelemetryState = {
    connection: "idle",
    snapshot: null,
    selectedPedal: null,
    nowMonoMs: 0,
  };
  private listeners = new Set<() => void>();
  private pedal = new PedalSelector();
  lastNotificationMonoMs: number | null = null;
  getState = () => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private emit(next: TelemetryState) {
    this.state = next;
    for (const listener of this.listeners) listener();
  }
  setConnection(connection: ConnectionState): void {
    if (connection !== "connected" && connection !== "waiting") {
      this.pedal = new PedalSelector();
      this.lastNotificationMonoMs = null;
      this.emit({
        ...this.state,
        connection,
        snapshot: null,
        selectedPedal: null,
      });
    } else this.emit({ ...this.state, connection });
  }
  noteNotification(now: number): void {
    this.lastNotificationMonoMs = now;
  }
  publish(snapshot: Snapshot): void {
    if (
      this.state.connection !== "connected" &&
      this.state.connection !== "waiting"
    )
      return;
    const selectedPedal = this.pedal.observe(snapshot, snapshot.receivedMonoMs);
    this.emit({
      connection: "connected",
      snapshot,
      selectedPedal,
      nowMonoMs: snapshot.receivedMonoMs,
    });
  }
  tick(now: number): void {
    if (this.state.snapshot && now !== this.state.nowMonoMs)
      this.emit({ ...this.state, nowMonoMs: now });
  }
}
export function selectReading(
  state: TelemetryState,
  id: SignalId,
  now = state.nowMonoMs,
): Reading | null {
  const frame = state.snapshot;
  if (
    state.connection !== "connected" ||
    !frame ||
    now - frame.receivedMonoMs >= STREAM_TIMEOUT_MS
  )
    return null;
  const reading = frame.readings[id]!;
  return reading.valid &&
    effectiveAge(reading, frame.receivedMonoMs, now).ms < freshnessLimit(id)
    ? reading
    : null;
}
