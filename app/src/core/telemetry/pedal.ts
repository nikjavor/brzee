import { PedalId, Snapshot } from "../protocol/types";
import { effectiveAge, freshnessLimit, sampleUptime } from "./freshness";

export interface CandidateObservation {
  signalId: PedalId;
  raw: number;
  valid: boolean;
  effectiveAgeMs: number;
  sampledUptimeMs: number;
}
const preference: readonly PedalId[] = [19, 16, 17, 18];
export class PedalSelector {
  private started: number | null = null;
  private selected: PedalId | null = null;
  private evidence = new Map<PedalId, { sample: number; count: number }>();
  observe(snapshot: Snapshot, now: number): PedalId | null {
    if (this.selected !== null) return this.selected;
    this.started ??= now;
    const candidates = preference.filter((id) => {
      const reading = snapshot.readings[id]!;
      const good =
        reading.valid &&
        reading.raw >= 0 &&
        reading.raw <= 100 &&
        effectiveAge(reading, snapshot.receivedMonoMs, now).ms <
          freshnessLimit(id);
      if (good) {
        const sample = sampleUptime(snapshot, id),
          previous = this.evidence.get(id);
        this.evidence.set(id, {
          sample,
          count: previous
            ? previous.count + (previous.sample !== sample ? 1 : 0)
            : 1,
        });
      } else this.evidence.delete(id);
      return good;
    });
    if (now - this.started < 2000) return null;
    this.selected =
      candidates.find((id) => (this.evidence.get(id)?.count ?? 0) >= 2) ??
      candidates[0] ??
      null;
    return this.selected;
  }
}
