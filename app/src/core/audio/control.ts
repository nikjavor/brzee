import { TelemetryState, selectReading } from "../telemetry/store";
import { freshnessLimit, STREAM_TIMEOUT_MS } from "../telemetry/freshness";
import { LearningState } from "../vehicle/types";
import { SoundProfile, LayerId } from "./types";
export type MuteReason =
  | "user"
  | "route"
  | "interruption"
  | "rpm"
  | "stream"
  | "recovering"
  | "disconnected";
export interface SoundIntent {
  enabled: boolean;
  volume: number;
  routeMuted: boolean;
  interrupted: boolean;
  generation: number;
}
export interface LayerTarget {
  layerId: LayerId;
  gain: number;
  rate: number;
}
export interface AudioControl {
  mode: "muted" | "pedal" | "rpm-only";
  reason: MuteReason | null;
  layers: LayerTarget[];
  rpmOnlyLayers: LayerTarget[];
  rpmExpiresMonoMs: number;
  streamExpiresMonoMs: number;
  pedalExpiresMonoMs: number | null;
  rampMs: number;
}
const clamp = (v: number, min = 0, max = 1) => Math.min(max, Math.max(min, v));
export function mappingCeiling(learning: LearningState, now: number): number {
  const m = learning.mappingCeiling;
  return (
    m.fromRpm +
    (m.toRpm - m.fromRpm) *
      clamp((now - m.startedMonoMs) / Math.max(1, m.durationMs))
  );
}
function targets(
  profile: SoundProfile,
  rpm: number,
  load: number,
  volume: number,
): LayerTarget[] {
  const weighted = profile.layers.map((layer) => {
    const ratio = rpm / layer.referenceRpm,
      position = Math.log(ratio);
    const width = Math.abs(
      Math.log(position < 0 ? layer.minimumRate : layer.maximumRate),
    );
    const rpmGain =
      ratio < layer.minimumRate || ratio > layer.maximumRate
        ? 0
        : Math.max(0, 1 - Math.abs(position) / Math.max(0.01, width));
    const loadGain =
      layer.group === "idle"
        ? 1
        : Math.sqrt(layer.group === "on" ? load : 1 - load);
    return {
      layerId: layer.id,
      rate: clamp(ratio, layer.minimumRate, layer.maximumRate),
      gain: rpmGain * loadGain,
    };
  });
  const power = Math.sqrt(weighted.reduce((sum, l) => sum + l.gain ** 2, 0));
  const trims = profile.layers.map((layer) => 10 ** (layer.gainDb / 20));
  // Fixed headroom keeps the worst correlated peak sum <= 0.6 without
  // amplitude-normalizing away equal-power crossfades or loudness trims.
  const headroom =
    0.6 / Math.sqrt(trims.reduce((sum, trim) => sum + trim ** 2, 0));
  return weighted.map((l, index) => ({
    ...l,
    gain:
      power > 0
        ? (l.gain / power) * trims[index]! * headroom * clamp(volume)
        : 0,
  }));
}
export function createControl(
  state: TelemetryState,
  learning: LearningState,
  profile: SoundProfile,
  intent: SoundIntent,
  now: number,
): AudioControl {
  const muted = (reason: MuteReason): AudioControl => ({
    mode: "muted",
    reason,
    layers: [],
    rpmOnlyLayers: [],
    rpmExpiresMonoMs: now,
    streamExpiresMonoMs: now,
    pedalExpiresMonoMs: null,
    rampMs: 200,
  });
  if (intent.routeMuted) return muted("route");
  if (!intent.enabled) return muted("user");
  if (intent.interrupted) return muted("interruption");
  if (state.connection !== "connected" || !state.snapshot)
    return muted("disconnected");
  const frame = state.snapshot;
  if (now - frame.receivedMonoMs >= STREAM_TIMEOUT_MS) return muted("stream");
  const rpm = selectReading(state, 0, now);
  if (!rpm || rpm.raw <= 0 || rpm.raw > 30000) return muted("rpm");
  const idle = learning.saved.idleRpm ?? 800;
  const progress = clamp(
    (rpm.raw - idle) / Math.max(500, mappingCeiling(learning, now) - idle),
  );
  const mapped =
    profile.idleRpm + progress * (profile.maximumRpm - profile.idleRpm);
  const pedal =
    state.selectedPedal !== null
      ? selectReading(state, state.selectedPedal, now)
      : null;
  const usablePedal = pedal !== null && pedal.raw >= 0 && pedal.raw <= 100;
  const calibration =
    state.selectedPedal !== null
      ? learning.saved.pedalCalibration[state.selectedPedal]
      : undefined;
  const load = usablePedal
    ? clamp(
        calibration
          ? (pedal.raw - calibration.released) /
              (calibration.pressed - calibration.released)
          : pedal.raw / 100,
      )
    : 0.25;
  return {
    mode: usablePedal ? "pedal" : "rpm-only",
    reason: null,
    layers: targets(profile, mapped, load, intent.volume),
    rpmOnlyLayers: targets(profile, mapped, 0.25, intent.volume),
    rpmExpiresMonoMs: frame.receivedMonoMs + freshnessLimit(0) - rpm.wireAgeMs,
    streamExpiresMonoMs: frame.receivedMonoMs + STREAM_TIMEOUT_MS,
    pedalExpiresMonoMs: usablePedal
      ? frame.receivedMonoMs +
        freshnessLimit(state.selectedPedal!) -
        pedal.wireAgeMs
      : null,
    rampMs: 200,
  };
}
