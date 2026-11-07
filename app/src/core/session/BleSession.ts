import { Clock } from "../protocol/types";
import { TelemetryStore } from "../telemetry/store";
import { BleTransport, DiscoveredDevice } from "../../platform/ble/types";
import { Assembler } from "../protocol/assembler";
import { TelemetryProbe } from "../../diagnostics/telemetryProbe";
export interface SessionState {
  devices: DiscoveredDevice[];
  message: string;
  error: string | null;
  selectedId: string | null;
  retryAttempt: number;
}
export class BleSession {
  private generation = 0;
  private attemptToken = 0;
  private abort = new AbortController();
  private assembler = new Assembler();
  private retry: ReturnType<typeof setTimeout> | null = null;
  private waiting: ReturnType<typeof setTimeout> | null = null;
  private state: SessionState = {
    devices: [],
    message: "Ready to connect",
    error: null,
    selectedId: null,
    retryAttempt: 0,
  };
  private listeners = new Set<() => void>();
  readonly probe = new TelemetryProbe();
  constructor(
    readonly transport: BleTransport,
    readonly store: TelemetryStore,
    readonly clock: Clock,
  ) {}
  getState = () => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private update(update: Partial<SessionState>) {
    this.state = { ...this.state, ...update };
    for (const listener of this.listeners) listener();
  }
  private clearTimers() {
    if (this.retry) clearTimeout(this.retry);
    if (this.waiting) clearTimeout(this.waiting);
    this.retry = null;
    this.waiting = null;
  }
  async scan(): Promise<DiscoveredDevice[]> {
    const cleanup = this.cancel();
    const generation = this.generation;
    await cleanup;
    if (generation !== this.generation) return [];
    this.store.setConnection("scanning");
    this.update({ message: "Looking for BRZEE…", error: null, devices: [] });
    try {
      const devices = await this.transport.scan(this.abort.signal);
      if (generation !== this.generation) return [];
      this.update({
        devices,
        message: devices.length
          ? "Choose your BRZEE"
          : "No BRZEE found. Check its power and try again.",
      });
      this.store.setConnection(devices.length ? "selecting" : "error");
      return devices;
    } catch (error) {
      if (generation === this.generation) {
        this.update({
          error: String(error),
          message: "Connection unavailable",
        });
        this.store.setConnection("error");
      }
      return [];
    }
  }
  async connect(id: string): Promise<void> {
    const cleanup = this.cancel(),
      generation = this.generation;
    await cleanup;
    if (generation !== this.generation) return;
    this.update({ selectedId: id, error: null, retryAttempt: 0 });
    await this.attempt(id, generation);
  }
  private async attempt(id: string, generation: number): Promise<void> {
    if (generation !== this.generation) return;
    const token = ++this.attemptToken;
    await this.transport.disconnect();
    if (generation !== this.generation || token !== this.attemptToken) return;
    this.assembler.reset();
    this.store.setConnection("connecting");
    this.update({ message: "Connecting to BRZEE…" });
    try {
      await this.transport.connect(
        id,
        (bytes) => {
          if (
            generation !== this.generation ||
            token !== this.attemptToken ||
            this.abort.signal.aborted
          )
            return;
          const now = this.clock.nowMs();
          this.store.noteNotification(now);
          this.probe.notification(bytes, now);
          const snapshot = this.assembler.push(bytes, now);
          if (snapshot) {
            if (this.waiting) clearTimeout(this.waiting);
            if (this.store.getState().connection === "connecting")
              this.store.setConnection("waiting");
            this.probe.complete(snapshot);
            this.store.publish(snapshot);
            this.update({
              message: "Live telemetry",
              error: null,
              retryAttempt: 0,
            });
          }
        },
        (error) => {
          if (generation !== this.generation || token !== this.attemptToken)
            return;
          this.attemptToken++;
          this.assembler.reset();
          this.store.setConnection("disconnected");
          this.update({
            message: "Disconnected. Reconnecting…",
            error: error?.message ?? null,
          });
          this.scheduleRetry(id, generation);
        },
        this.abort.signal,
      );
      if (generation !== this.generation || token !== this.attemptToken) return;
      if (this.store.getState().connection === "connecting") {
        this.store.setConnection("waiting");
        this.update({ message: "Connected. Waiting for telemetry…" });
        this.waiting = setTimeout(() => {
          if (generation === this.generation && !this.store.getState().snapshot)
            this.update({
              message:
                "No complete telemetry yet. Check BRZEE, retry, or disconnect.",
            });
        }, 5000);
      }
    } catch (error) {
      if (generation !== this.generation || token !== this.attemptToken) return;
      this.store.setConnection("disconnected");
      this.update({
        error: String(error),
        message: "Could not connect. Retrying…",
      });
      this.scheduleRetry(id, generation);
    }
  }
  private scheduleRetry(id: string, generation: number) {
    this.clearTimers();
    const attempt = this.state.retryAttempt;
    this.update({ retryAttempt: attempt + 1 });
    this.retry = setTimeout(() => {
      void this.attempt(id, generation);
    }, [1000, 2000, 4000, 8000][Math.min(attempt, 3)]!);
  }
  async cancel(): Promise<void> {
    this.generation++;
    this.attemptToken++;
    this.abort.abort();
    this.abort = new AbortController();
    this.clearTimers();
    this.assembler.reset();
    this.store.setConnection("idle");
    this.update({
      selectedId: null,
      devices: [],
      message: "Ready to connect",
      error: null,
      retryAttempt: 0,
    });
    await this.transport.disconnect();
  }
}
