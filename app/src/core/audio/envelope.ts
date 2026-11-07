import { AudioControl, LayerTarget } from "./control";
export interface GainPoint {
  timeSeconds: number;
  value: number;
}
export interface GainEnvelope {
  master: GainPoint[];
  layers: Record<string, GainPoint[]>;
}
export function planEnvelope(
  control: AudioControl,
  now: number,
  audioTime: number,
): GainEnvelope {
  const remaining =
      Math.min(control.rpmExpiresMonoMs, control.streamExpiresMonoMs) - now,
    ramp = control.rampMs / 1000;
  if (control.mode === "muted" && control.reason === "interruption")
    return { master: [{ timeSeconds: audioTime, value: 0 }], layers: {} };
  if (control.mode === "muted" || remaining <= 0)
    return {
      master: [{ timeSeconds: audioTime + ramp, value: 0 }],
      layers: {},
    };
  const expiry = audioTime + remaining / 1000,
    attack = Math.min(expiry, audioTime + ramp);
  const master = [
    { timeSeconds: attack, value: 1 },
    { timeSeconds: expiry, value: 1 },
    { timeSeconds: expiry + ramp, value: 0 },
  ];
  const layers: Record<string, GainPoint[]> = {};
  for (const target of control.layers) {
    const pedalExpiry =
      control.pedalExpiresMonoMs !== null
        ? audioTime + Math.max(0, control.pedalExpiresMonoMs - now) / 1000
        : null;
    const points = [
      {
        timeSeconds: Math.min(attack, pedalExpiry ?? Infinity),
        value: target.gain,
      },
    ];
    if (pedalExpiry !== null && pedalExpiry < expiry) {
      points.push({ timeSeconds: pedalExpiry, value: target.gain });
      points.push({
        timeSeconds: pedalExpiry + ramp,
        value:
          control.rpmOnlyLayers.find((l) => l.layerId === target.layerId)
            ?.gain ?? 0,
      });
    }
    layers[target.layerId] = points;
  }
  return { master, layers };
}
export function valueAt(points: GainPoint[], time: number): number {
  if (!points.length) return 0;
  let previous = points[0]!;
  if (time <= previous.timeSeconds) return previous.value;
  for (const point of points.slice(1)) {
    if (time <= point.timeSeconds) {
      const t =
        (time - previous.timeSeconds) /
        Math.max(1e-9, point.timeSeconds - previous.timeSeconds);
      return previous.value + (point.value - previous.value) * t;
    }
    previous = point;
  }
  return previous.value;
}
export type { LayerTarget };
