import { SoundSession, RecoveryGate } from "../../src/core/audio/lifecycle";
import { Snapshot } from "../../src/core/protocol/types";
const frame = (capture: number, now: number): Snapshot => ({
  sequence: capture & 65535,
  capturedUptimeMs: capture,
  receivedMonoMs: now,
  readings: [],
});
test("starts muted; call may resume prior intent but route removal latches through call end and replug", () => {
  const sound = new SoundSession();
  expect(sound.intent.enabled).toBe(false);
  expect(sound.enable()).toBe(true);
  sound.interruption("began");
  expect(sound.intent.interrupted).toBe(true);
  sound.interruption("ended", true);
  expect(sound.intent.enabled).toBe(true);
  expect(sound.intent.interrupted).toBe(false);
  sound.interruption("began");
  sound.routeRemoved();
  sound.routeAvailable();
  sound.interruption("ended", true);
  expect(sound.intent.enabled).toBe(false);
  expect(sound.intent.routeMuted).toBe(true);
  expect(sound.enable()).toBe(true);
  expect(sound.intent.routeMuted).toBe(false);
});
test("manual mute during a call and OS refusal cannot be undone by call end", () => {
  const sound = new SoundSession();
  sound.enable();
  sound.interruption("began");
  sound.mute();
  sound.interruption("ended", true);
  expect(sound.intent.enabled).toBe(false);
  sound.enable();
  sound.interruption("began");
  sound.interruption("ended", false);
  expect(sound.intent.enabled).toBe(false);
});
test("control gaps quarantine rapid queued snapshots until advancing fresh receipt spans 200ms", () => {
  const gate = new RecoveryGate();
  for (const t of [0, 100, 200]) gate.noteSnapshot(frame(t, t), t);
  expect(gate.noteControl(200)).toBe(true);
  expect(gate.noteControl(1200)).toBe(false);
  for (const t of [300, 400, 500]) gate.noteSnapshot(frame(t, 1201), 1201);
  expect(gate.noteControl(1201)).toBe(false);
  gate.noteSnapshot(frame(1300, 1301), 1301);
  gate.noteSnapshot(frame(1400, 1401), 1401);
  expect(gate.noteControl(1401)).toBe(true);
  gate.requireRecovery();
  expect(gate.noteControl(1402)).toBe(false);
});

test("a brief controller or packet delay does not unnecessarily restart sound recovery", () => {
  const controller = new RecoveryGate();
  for (const t of [0, 100, 200]) controller.noteSnapshot(frame(t, t), t);
  expect(controller.noteControl(200)).toBe(true);
  expect(controller.noteControl(800)).toBe(true);
  const packets = new RecoveryGate();
  for (const t of [0, 100, 200]) packets.noteSnapshot(frame(t, t), t);
  expect(packets.noteControl(200)).toBe(true);
  packets.noteSnapshot(frame(800, 800), 800);
  expect(packets.noteControl(800)).toBe(true);
});
