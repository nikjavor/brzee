import { planEnvelope, valueAt } from "../../src/core/audio/envelope";
import { AudioControl } from "../../src/core/audio/control";
const control: AudioControl = {
  mode: "pedal",
  reason: null,
  layers: [{ layerId: "on-low", gain: 0.5, rate: 1 }],
  rpmOnlyLayers: [{ layerId: "on-low", gain: 0.2, rate: 1 }],
  rpmExpiresMonoMs: 100,
  streamExpiresMonoMs: 1000,
  pedalExpiresMonoMs: null,
  rampMs: 200,
};
test("interruption removes held gain immediately so a paused native clock cannot resume an old tone", () => {
  const envelope = planEnvelope(
    { ...control, mode: "muted", reason: "interruption" },
    100,
    10.1,
  );
  expect(
    valueAt([{ timeSeconds: 10, value: 1 }, ...envelope.master], 10.11),
  ).toBe(0);
});
test("repeated old-RPM controls expire at the original deadline on the native clock", () => {
  for (const now of [0, 50, 90]) {
    const envelope = planEnvelope(control, now, 10 + now / 1000);
    expect(valueAt(envelope.master, 10.099)).toBeGreaterThan(0);
    expect(valueAt(envelope.master, 10.3)).toBeCloseTo(0, 6);
  }
});
test("expired control never arms a positive gain", () => {
  const envelope = planEnvelope(control, 100, 10.1);
  expect(envelope.master.every((p) => p.value === 0)).toBe(true);
  expect(envelope.master.length).toBeGreaterThan(0);
});
test("pedal expiry pre-schedules RPM-only load while keeping RPM expiry independent", () => {
  const envelope = planEnvelope(
    { ...control, rpmExpiresMonoMs: 900, pedalExpiresMonoMs: 100 },
    0,
    10,
  );
  expect(valueAt(envelope.layers["on-low"]!, 10.09)).toBeCloseTo(0.5);
  expect(valueAt(envelope.layers["on-low"]!, 10.3)).toBeCloseTo(0.2);
  expect(valueAt(envelope.master, 10.8)).toBeGreaterThan(0);
  expect(valueAt(envelope.master, 11.1)).toBeCloseTo(0);
});
