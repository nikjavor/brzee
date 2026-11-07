import { SoundIntent } from "./control";
import { Snapshot } from "../protocol/types";
import { STREAM_TIMEOUT_MS } from "../telemetry/freshness";
export class SoundSession {
  intent: SoundIntent = {
    enabled: false,
    volume: 0.5,
    routeMuted: false,
    interrupted: false,
    generation: 0,
  };
  private resumeGeneration: number | null = null;
  enable(): boolean {
    if (this.intent.interrupted) return false;
    this.intent = {
      ...this.intent,
      enabled: true,
      routeMuted: false,
      generation: this.intent.generation + 1,
    };
    return true;
  }
  mute(): void {
    this.intent = {
      ...this.intent,
      enabled: false,
      generation: this.intent.generation + 1,
    };
  }
  routeRemoved(): void {
    this.mute();
    this.intent = { ...this.intent, routeMuted: true };
  }
  routeAvailable(): void {} // Replugging never clears the manual-enable latch.
  interruption(type: "began" | "ended", shouldResume = false): void {
    if (type === "began") {
      this.resumeGeneration = this.intent.generation;
      this.intent = { ...this.intent, interrupted: true };
    } else {
      const resume =
        shouldResume &&
        this.resumeGeneration === this.intent.generation &&
        !this.intent.routeMuted &&
        this.intent.enabled;
      this.intent = { ...this.intent, interrupted: false, enabled: resume };
      this.resumeGeneration = null;
    }
  }
}
export class RecoveryGate {
  private lastControl: number | null = null;
  private lastReceipt: number | null = null;
  private capture: number | null = null;
  private evidence: number[] = [];
  private ready = false;
  noteControl(now: number): boolean {
    if (
      this.lastControl !== null &&
      now - this.lastControl >= STREAM_TIMEOUT_MS
    )
      this.requireRecovery();
    this.lastControl = now;
    return this.ready;
  }
  noteSnapshot(frame: Snapshot, now: number): void {
    if (
      this.lastReceipt !== null &&
      now - this.lastReceipt >= STREAM_TIMEOUT_MS
    )
      this.requireRecovery();
    this.lastReceipt = now;
    if (this.capture !== null) {
      const d = (frame.capturedUptimeMs - this.capture) >>> 0;
      if (d === 0 || d >= 0x80000000) return;
    }
    this.capture = frame.capturedUptimeMs;
    this.evidence.push(now);
    if (this.evidence.length > 3) this.evidence.shift();
    if (this.evidence.length === 3 && now - this.evidence[0]! >= 200)
      this.ready = true;
  }
  requireRecovery(): void {
    this.ready = false;
    this.evidence = [];
    this.capture = null;
    this.lastReceipt = null;
  }
}
