import { LearningState, LearnedVehicle } from "./types";
import { PedalId } from "../protocol/types";
import { mappingCeiling } from "../audio/control";
export interface LearningObservation {
  nowMonoMs: number;
  rpm: number | null;
  rpmAgeMs: number;
  sampledUptimeMs: number;
  speed: number | null;
  pedalId: PedalId | null;
  pedal: number | null;
  captureIdle?: boolean;
}
export const defaultVehicle = (): LearnedVehicle => ({
  schemaVersion: 1,
  rpmCeiling: 5000,
  idleRpm: null,
  pedalCalibration: {},
});
export function initialLearning(saved = defaultVehicle()): LearningState {
  return {
    saved,
    ceilingEvidence: [],
    idleEvidence: [],
    pendingPedalCapture: null,
    mappingCeiling: {
      fromRpm: saved.rpmCeiling,
      toRpm: saved.rpmCeiling,
      startedMonoMs: 0,
      durationMs: 1000,
    },
  };
}
export function updateLearning(
  state: LearningState,
  o: LearningObservation,
): LearningState {
  const fresh =
    o.rpm !== null &&
    Number.isFinite(o.rpm) &&
    o.rpm > 0 &&
    o.rpm <= 30000 &&
    o.rpmAgeMs < 500;
  const sample = {
    rpm: o.rpm ?? 0,
    sampledUptimeMs: o.sampledUptimeMs,
    observedMonoMs: o.nowMonoMs,
  };
  let next = { ...state };
  const previous = state.ceilingEvidence.at(-1);
  const distinct =
    !previous ||
    ((o.sampledUptimeMs - previous.sampledUptimeMs) >>> 0 > 0 &&
      (o.sampledUptimeMs - previous.sampledUptimeMs) >>> 0 < 0x80000000);
  if (!fresh || o.rpm! <= state.saved.rpmCeiling) next.ceilingEvidence = [];
  else if (distinct) {
    next.ceilingEvidence = [
      ...state.ceilingEvidence.filter(
        (s) => o.nowMonoMs - s.observedMonoMs < 2000,
      ),
      sample,
    ].slice(-3);
    if (next.ceilingEvidence.length === 3) {
      const ceiling = Math.min(
        30000,
        Math.ceil(Math.min(...next.ceilingEvidence.map((s) => s.rpm)) / 500) *
          500,
      );
      next = {
        ...next,
        saved: { ...next.saved, rpmCeiling: ceiling },
        ceilingEvidence: [],
        mappingCeiling: {
          fromRpm: mappingCeiling(state, o.nowMonoMs),
          toRpm: ceiling,
          startedMonoMs: o.nowMonoMs,
          durationMs: 1000,
        },
      };
    }
  }
  if (!o.captureIdle || !fresh || o.speed !== 0) next.idleEvidence = [];
  else {
    if (
      next.idleEvidence.length &&
      o.nowMonoMs - next.idleEvidence.at(-1)!.observedMonoMs >= 500
    )
      next.idleEvidence = [];
    const last = next.idleEvidence.at(-1);
    if (!last || last.sampledUptimeMs !== sample.sampledUptimeMs) {
      const candidates = [...next.idleEvidence, sample];
      next.idleEvidence =
        Math.max(...candidates.map((s) => s.rpm)) -
          Math.min(...candidates.map((s) => s.rpm)) <=
        50
          ? candidates.slice(-64)
          : [sample];
      if (
        next.idleEvidence.length >= 3 &&
        o.nowMonoMs - next.idleEvidence[0]!.observedMonoMs >= 3000
      ) {
        const values = next.idleEvidence
            .map((s) => s.rpm)
            .sort((a, b) => a - b),
          median = values[Math.floor(values.length / 2)]!;
        if (median < next.saved.rpmCeiling)
          next.saved = { ...next.saved, idleRpm: median };
        next.idleEvidence = [];
      }
    }
  }
  return next;
}
export function capturePedal(
  state: LearningState,
  action: "released" | "pressed" | "cancel",
  o: LearningObservation,
): { state: LearningState; error: string | null; complete: boolean } {
  if (action === "cancel")
    return {
      state: { ...state, pendingPedalCapture: null },
      error: null,
      complete: false,
    };
  if (
    o.speed !== 0 ||
    o.pedalId === null ||
    o.pedal === null ||
    !Number.isFinite(o.pedal) ||
    o.pedal < 0 ||
    o.pedal > 100
  )
    return {
      state,
      error: "Capture requires a fresh pedal reading while stationary.",
      complete: false,
    };
  if (action === "released")
    return {
      state: {
        ...state,
        pendingPedalCapture: { signalId: o.pedalId, released: o.pedal },
      },
      error: null,
      complete: false,
    };
  const pending = state.pendingPedalCapture;
  if (
    !pending ||
    pending.signalId !== o.pedalId ||
    pending.released === null ||
    o.pedal - pending.released < 5
  )
    return {
      state,
      error:
        "Capture the same channel with at least 5 percentage points of travel.",
      complete: false,
    };
  return {
    state: {
      ...state,
      pendingPedalCapture: null,
      saved: {
        ...state.saved,
        pedalCalibration: {
          ...state.saved.pedalCalibration,
          [o.pedalId]: { released: pending.released, pressed: o.pedal },
        },
      },
    },
    error: null,
    complete: true,
  };
}
