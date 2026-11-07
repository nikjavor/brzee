import { validateProfile, loopTimes } from "../../src/core/audio/profile";
import { SoundProfile, LayerId } from "../../src/core/audio/types";
const ids: LayerId[] = [
  "idle",
  "on-low",
  "on-mid",
  "on-high",
  "on-very-high",
  "off-low",
  "off-mid",
  "off-high",
];
function candidate(): SoundProfile {
  return {
    schemaVersion: 1,
    id: "test",
    name: "Test",
    idleRpm: 800,
    maximumRpm: 7000,
    confidence: "estimated",
    layers: ids.map((id) => ({
      id,
      file: `${id}.wav`,
      group: id === "idle" ? "idle" : id.startsWith("on") ? "on" : "off",
      sampleRate: 44100,
      frameCount: 176400,
      loopStartFrame: 44100,
      loopEndFrame: 132300,
      referenceRpm: 2500,
      gainDb: -6,
      minimumRate: 0.75,
      maximumRate: 1.35,
    })),
  };
}
const files = ids.map((id) => `${id}.wav`);
test("accepts a complete profile and converts original frames through seconds at 48k output", () => {
  const profile = validateProfile(candidate(), files)!;
  expect(profile).not.toBeNull();
  expect(loopTimes(profile.layers[0]!, 48000)).toEqual({
    startSec: 1,
    endSec: 3,
    startDecodedFrame: 48000,
    endDecodedFrame: 144000,
  });
});
test.each([
  "missing-layer",
  "duplicate-layer",
  "missing-file",
  "reversed",
  "past-end",
  "rate",
  "gain",
  "version",
  "rpm",
  "sample-rate",
  "fractional-frame",
])("rejects %s", (kind) => {
  const p = candidate(),
    layer = p.layers[0]!;
  if (kind === "missing-layer") p.layers.pop();
  if (kind === "duplicate-layer") p.layers[7] = p.layers[0]!;
  if (kind === "missing-file") layer.file = "missing.wav";
  if (kind === "reversed") layer.loopEndFrame = 1;
  if (kind === "past-end") layer.loopEndFrame = 176401;
  if (kind === "rate") layer.maximumRate = 0.5;
  if (kind === "gain") layer.gainDb = NaN;
  if (kind === "version")
    (p as unknown as { schemaVersion: number }).schemaVersion = 2;
  if (kind === "rpm") layer.referenceRpm = Infinity;
  if (kind === "sample-rate") layer.sampleRate = 0;
  if (kind === "fractional-frame") layer.loopStartFrame = 1.2;
  expect(validateProfile(p, files)).toBeNull();
});
