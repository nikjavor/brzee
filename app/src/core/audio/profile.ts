import { SoundLayer, SoundProfile } from "./types";
export function validateProfile(
  input: unknown,
  files: readonly string[],
): SoundProfile | null {
  if (!input || typeof input !== "object") return null;
  const p = input as SoundProfile;
  if (
    p.schemaVersion !== 1 ||
    !p.id ||
    !p.name ||
    !Number.isFinite(p.idleRpm) ||
    p.idleRpm <= 0 ||
    !Number.isFinite(p.maximumRpm) ||
    p.maximumRpm <= p.idleRpm ||
    !Array.isArray(p.layers) ||
    p.layers.length !== 8
  )
    return null;
  const expected = [
    "idle",
    "on-low",
    "on-mid",
    "on-high",
    "on-very-high",
    "off-low",
    "off-mid",
    "off-high",
  ];
  if (new Set(p.layers.map((l) => l?.id)).size !== 8) return null;
  for (const l of p.layers) {
    if (
      !l ||
      !expected.includes(l.id) ||
      !files.includes(l.file) ||
      l.group !==
        (l.id === "idle" ? "idle" : l.id.startsWith("on-") ? "on" : "off")
    )
      return null;
    if (
      ![l.sampleRate, l.frameCount, l.loopStartFrame, l.loopEndFrame].every(
        Number.isInteger,
      ) ||
      l.sampleRate <= 0 ||
      l.loopStartFrame < 0 ||
      l.loopEndFrame <= l.loopStartFrame ||
      l.loopEndFrame > l.frameCount
    )
      return null;
    if (
      ![l.referenceRpm, l.gainDb, l.minimumRate, l.maximumRate].every(
        Number.isFinite,
      ) ||
      l.referenceRpm <= 0 ||
      l.gainDb < -60 ||
      l.gainDb > 12 ||
      l.minimumRate < 0.25 ||
      l.maximumRate > 4 ||
      l.minimumRate > l.maximumRate
    )
      return null;
  }
  return p;
}
export function loopTimes(layer: SoundLayer, outputRate: number) {
  const startSec = layer.loopStartFrame / layer.sampleRate,
    endSec = layer.loopEndFrame / layer.sampleRate;
  return {
    startSec,
    endSec,
    startDecodedFrame: Math.round(startSec * outputRate),
    endDecodedFrame: Math.round(endSec * outputRate),
  };
}
