import { PedalId } from "../protocol/types";
export interface PedalCalibration {
  released: number;
  pressed: number;
}
export interface LearnedVehicle {
  schemaVersion: 1;
  rpmCeiling: number;
  idleRpm: number | null;
  pedalCalibration: Partial<Record<PedalId, PedalCalibration>>;
}
export interface RpmSample {
  rpm: number;
  sampledUptimeMs: number;
  observedMonoMs: number;
}
export interface LearningState {
  saved: LearnedVehicle;
  ceilingEvidence: RpmSample[];
  idleEvidence: RpmSample[];
  mappingCeiling: {
    fromRpm: number;
    toRpm: number;
    startedMonoMs: number;
    durationMs: number;
  };
  pendingPedalCapture: { signalId: PedalId; released: number | null } | null;
}
