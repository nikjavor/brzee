import { Snapshot } from "../core/protocol/types";
export class TelemetryProbe {
  notifications = 0;
  snapshots = 0;
  gaps = 0;
  lastFragmentCount = 0;
  firstMonoMs: number | null = null;
  lastMonoMs = 0;
  private sequence: number | null = null;
  notification(bytes: Uint8Array, now: number) {
    this.notifications++;
    this.firstMonoMs ??= now;
    this.lastMonoMs = now;
    this.lastFragmentCount = bytes[4] ?? 0;
  }
  complete(snapshot: Snapshot) {
    this.snapshots++;
    if (this.sequence !== null) {
      const d = (snapshot.sequence - this.sequence) & 65535;
      if (d > 1 && d < 32768) this.gaps += d - 1;
    }
    this.sequence = snapshot.sequence;
  }
  report(now: number) {
    const seconds = Math.max(1, (now - (this.firstMonoMs ?? now)) / 1000);
    return {
      notificationsPerSecond: this.notifications / seconds,
      snapshotsPerSecond: this.snapshots / seconds,
      gaps: this.gaps,
      fragments: this.lastFragmentCount,
    };
  }
}
