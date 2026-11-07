import { TelemetryStore, selectReading } from "../../src/core/telemetry/store";
import { effectiveAge } from "../../src/core/telemetry/freshness";
import { Snapshot, SignalId } from "../../src/core/protocol/types";

function snapshot(
  now: number,
  entries: Partial<Record<SignalId, [number, number]>>,
  capture = now,
): Snapshot {
  return {
    sequence: Math.floor(now),
    capturedUptimeMs: capture,
    receivedMonoMs: now,
    readings: Array.from({ length: 35 }, (_, id) => ({
      raw: entries[id as SignalId]?.[0] ?? 0,
      wireAgeMs: entries[id as SignalId]?.[1] ?? 0,
      valid: id in entries,
    })),
  };
}
test("sample ages advance independently of new snapshots and wall-clock changes", () => {
  const store = new TelemetryStore();
  store.setConnection("waiting");
  store.publish(snapshot(0, { 0: [2000, 1400], 1: [0, 0], 34: [-86, 0] }));
  expect(selectReading(store.getState(), 0, 99)?.raw).toBe(2000);
  store.publish(
    snapshot(100, { 0: [2000, 1500], 1: [0, 100], 34: [-86, 100] }),
  );
  expect(selectReading(store.getState(), 0, 100)).toBeNull();
  expect(selectReading(store.getState(), 1, 100)?.raw).toBe(0);
  expect(selectReading(store.getState(), 34, 100)?.raw).toBe(-86);
  expect(selectReading(store.getState(), 2, 100)).toBeNull();
  expect(
    effectiveAge({ wireAgeMs: 65535, raw: 0, valid: true }, 100, 200),
  ).toEqual({ ms: 65635, lowerBound: true });
});
test("fragments never publish or extend whole-stream freshness; disconnect is immediate", () => {
  const store = new TelemetryStore();
  store.setConnection("waiting");
  const observed: Snapshot[] = [];
  store.subscribe(() => {
    if (store.getState().snapshot) observed.push(store.getState().snapshot!);
  });
  const frame = snapshot(0, { 0: [800, 0] });
  store.publish(frame);
  for (let t = 100; t <= 1000; t += 100) store.noteNotification(t);
  expect(observed).toEqual([frame]);
  expect(store.getState().snapshot).toBe(frame);
  expect(selectReading(store.getState(), 0, 1000)).toBeNull();
  store.setConnection("disconnected");
  expect(selectReading(store.getState(), 0, 0)).toBeNull();
});
test("waits for consistently sampled candidates then pins relative pedal for the connection", () => {
  const store = new TelemetryStore();
  store.setConnection("waiting");
  for (let t = 0; t <= 2000; t += 250)
    store.publish(snapshot(t, { 16: [30, 0], 19: [10, 0] }));
  expect(store.getState().selectedPedal).toBe(19);
  store.publish(snapshot(2100, { 16: [90, 0] }));
  expect(store.getState().selectedPedal).toBe(19);
  expect(selectReading(store.getState(), 19, 2100)).toBeNull();
  store.setConnection("disconnected");
  store.setConnection("waiting");
  store.publish(snapshot(2200, { 17: [15, 0] }));
  store.publish(snapshot(4200, { 17: [15, 0] }));
  expect(store.getState().selectedPedal).toBe(17);
});
test("ignores throttle and invalid percents; permits later pedal after empty observation window", () => {
  const store = new TelemetryStore();
  store.setConnection("waiting");
  store.publish(snapshot(0, { 3: [70, 0], 19: [130, 0] }));
  store.publish(snapshot(2000, { 3: [80, 0] }));
  expect(store.getState().selectedPedal).toBeNull();
  store.publish(snapshot(2100, { 18: [25, 0], 19: [5, 1600] }));
  expect(store.getState().selectedPedal).toBe(18);
  expect(store.getState().snapshot?.readings[19]?.raw).toBe(5);
});
test("prefers repeatedly measured D over a single transient relative sample", () => {
  const store = new TelemetryStore();
  store.setConnection("waiting");
  store.publish(snapshot(0, { 16: [30, 0] }));
  store.publish(snapshot(1000, { 16: [31, 0] }));
  store.publish(snapshot(2000, { 16: [32, 0], 19: [5, 0] }));
  expect(store.getState().selectedPedal).toBe(16);
});

test("RPM, speed and pedal readings survive a brief sample gap but still have hard expiry", () => {
  const store = new TelemetryStore();
  store.setConnection("waiting");
  store.publish(
    snapshot(0, { 0: [2200, 1100], 1: [42, 1800], 19: [30, 1100] }),
  );
  expect(selectReading(store.getState(), 0, 0)?.raw).toBe(2200);
  expect(selectReading(store.getState(), 1, 0)?.raw).toBe(42);
  expect(selectReading(store.getState(), 19, 0)?.raw).toBe(30);
  expect(selectReading(store.getState(), 0, 400)).toBeNull();
  expect(selectReading(store.getState(), 19, 400)).toBeNull();
  expect(selectReading(store.getState(), 1, 700)).toBeNull();
});
