import {
  initialLearning,
  updateLearning,
  capturePedal,
  LearningObservation,
} from "../../src/core/vehicle/learning";
import { mappingCeiling } from "../../src/core/audio/control";
const obs = (rpm: number, now: number): LearningObservation => ({
  rpm,
  nowMonoMs: now,
  rpmAgeMs: 0,
  sampledUptimeMs: now,
  speed: 0,
  pedalId: 19,
  pedal: 10,
});
test("confirms three distinct fresh samples, never shrinks, and glides continuously to a raised ceiling", () => {
  let state = initialLearning();
  state = updateLearning(state, obs(5200, 0));
  state = updateLearning(state, obs(5300, 100));
  state = updateLearning(state, obs(5250, 200));
  expect(state.saved.rpmCeiling).toBe(5500);
  expect(mappingCeiling(state, 200)).toBe(5000);
  expect(mappingCeiling(state, 700)).toBe(5250);
  for (const t of [500, 600, 700]) state = updateLearning(state, obs(5700, t));
  expect(state.saved.rpmCeiling).toBe(6000);
  expect(mappingCeiling(state, 700)).toBe(5250);
  expect(mappingCeiling(state, 1700)).toBe(6000);
  state = updateLearning(state, obs(800, 1800));
  expect(state.saved.rpmCeiling).toBe(6000);
});
test("one spike, repeated sample timestamps and invalid/expired samples cannot expand the scale", () => {
  let state = initialLearning();
  for (const t of [0, 100, 200])
    state = updateLearning(state, { ...obs(6000, t), sampledUptimeMs: 0 });
  expect(state.saved.rpmCeiling).toBe(5000);
  state = updateLearning(state, { ...obs(6000, 300), rpmAgeMs: 500 });
  state = updateLearning(state, obs(6000, 400));
  expect(state.saved.rpmCeiling).toBe(5000);
  expect(
    initialLearning({ ...state.saved, rpmCeiling: 6500 }).mappingCeiling.toRpm,
  ).toBe(6500);
});
test("idle capture requires three seconds of distinct fresh stationary samples within 50rpm", () => {
  let state = initialLearning();
  for (let t = 0; t <= 2900; t += 100)
    state = updateLearning(state, {
      ...obs(t % 200 ? 810 : 800, t),
      captureIdle: true,
    });
  expect(state.saved.idleRpm).toBeNull();
  state = updateLearning(state, { ...obs(800, 3000), captureIdle: true });
  expect(state.saved.idleRpm).toBe(800);
  let moving = initialLearning();
  for (let t = 0; t <= 4000; t += 100)
    moving = updateLearning(moving, {
      ...obs(800, t),
      speed: t === 2000 ? 1 : 0,
      captureIdle: true,
    });
  expect(moving.saved.idleRpm).toBeNull();
});
test("pedal capture belongs to one fresh stationary channel and requires full-travel span", () => {
  let state = initialLearning();
  state = capturePedal(state, "released", obs(800, 0)).state;
  expect(
    capturePedal(state, "pressed", { ...obs(800, 1), pedalId: 16, pedal: 90 })
      .error,
  ).not.toBeNull();
  expect(
    capturePedal(state, "pressed", { ...obs(800, 1), pedal: 12 }).error,
  ).not.toBeNull();
  const result = capturePedal(state, "pressed", { ...obs(800, 1), pedal: 80 });
  expect(result.complete).toBe(true);
  expect(result.state.saved.pedalCalibration[19]).toEqual({
    released: 10,
    pressed: 80,
  });
  expect(result.state.saved.pedalCalibration[16]).toBeUndefined();
  expect(
    capturePedal(state, "cancel", obs(800, 2)).state.pendingPedalCapture,
  ).toBeNull();
});
test("an unobserved interval breaks a continuous stable idle capture", () => {
  let state = initialLearning();
  for (let t = 0; t <= 1000; t += 100)
    state = updateLearning(state, { ...obs(800, t), captureIdle: true });
  state = updateLearning(state, { ...obs(800, 4000), captureIdle: true });
  expect(state.saved.idleRpm).toBeNull();
});
test("one high outlier cannot set a ceiling unsupported by the other confirming RPM samples", () => {
  let state = initialLearning();
  for (const [rpm, now] of [
    [12000, 0],
    [5100, 100],
    [5200, 200],
  ])
    state = updateLearning(state, obs(rpm!, now!));
  expect(state.saved.rpmCeiling).toBe(5500);
});
