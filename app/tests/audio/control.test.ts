import metadata from "../../assets/sounds/911-gt3-rs/profile.json";
import { createControl, SoundIntent } from "../../src/core/audio/control";
import { SoundProfile } from "../../src/core/audio/types";
import { TelemetryState } from "../../src/core/telemetry/store";
import { LearningState } from "../../src/core/vehicle/types";
const profile = metadata as SoundProfile;
const intent: SoundIntent = {
  enabled: true,
  volume: 1,
  routeMuted: false,
  interrupted: false,
  generation: 0,
};
const learning: LearningState = {
  saved: {
    schemaVersion: 1,
    rpmCeiling: 5000,
    idleRpm: null,
    pedalCalibration: {},
  },
  ceilingEvidence: [],
  idleEvidence: [],
  pendingPedalCapture: null,
  mappingCeiling: {
    fromRpm: 5000,
    toRpm: 5000,
    startedMonoMs: 0,
    durationMs: 1000,
  },
};
export function live(
  rpm = 2500,
  age = 0,
  pedal: number | null = 50,
): TelemetryState {
  return {
    connection: "connected",
    selectedPedal: 19,
    nowMonoMs: 0,
    snapshot: {
      sequence: 1,
      capturedUptimeMs: 1000,
      receivedMonoMs: 0,
      readings: Array.from({ length: 35 }, (_, id) => ({
        raw: id === 0 ? rpm : id === 19 ? (pedal ?? 0) : 0,
        valid: id === 0 || (id === 19 && pedal !== null),
        wireAgeMs: id === 0 ? age : 0,
      })),
    },
  };
}
test("fresh RPM and pedal produce bounded positive continuous layer targets", () => {
  const result = createControl(live(), learning, profile, intent, 0);
  expect(result.mode).toBe("pedal");
  expect(result.layers.reduce((s, l) => s + l.gain, 0)).toBeGreaterThan(0);
  expect(result.layers.reduce((s, l) => s + l.gain, 0)).toBeLessThanOrEqual(
    0.600001,
  );
  for (const layer of result.layers) {
    const source = profile.layers.find((l) => l.id === layer.layerId)!;
    expect(layer.rate).toBeGreaterThanOrEqual(source.minimumRate);
    expect(layer.rate).toBeLessThanOrEqual(source.maximumRate);
  }
  expect(result.rpmExpiresMonoMs).toBe(1500);
});
test.each([0, -1, 2147483647])("unusable RPM %i fades out", (rpm) =>
  expect(createControl(live(rpm), learning, profile, intent, 0).mode).toBe(
    "muted",
  ),
);
test("invalid RPM stays muted even when throttle is present", () => {
  const state = live();
  state.snapshot = {
    ...state.snapshot!,
    readings: state.snapshot!.readings.map((r, id) =>
      id === 0 ? { ...r, valid: false } : r,
    ),
  };
  expect(createControl(state, learning, profile, intent, 0).reason).toBe("rpm");
});
test("missing or expired pedal uses a moderate RPM-only mix", () => {
  expect(
    createControl(live(2500, 0, null), learning, profile, intent, 0).mode,
  ).toBe("rpm-only");
  const state = live();
  state.snapshot = {
    ...state.snapshot!,
    readings: state.snapshot!.readings.map((r, id) =>
      id === 19 ? { ...r, wireAgeMs: 1500 } : r,
    ),
  };
  expect(createControl(state, learning, profile, intent, 0).mode).toBe(
    "rpm-only",
  );
  const first = createControl(
    live(2500, 0, null),
    learning,
    profile,
    intent,
    0,
  );
  const second = createControl(live(2500, 0, 25), learning, profile, intent, 0);
  expect(first.layers).toEqual(second.layers);
});
test("same old RPM in newer complete snapshots does not renew its deadline", () => {
  const state = live(2500, 1400);
  expect(
    createControl(state, learning, profile, intent, 0).rpmExpiresMonoMs,
  ).toBe(100);
  state.snapshot = {
    ...state.snapshot!,
    receivedMonoMs: 50,
    readings: state.snapshot!.readings.map((r, id) =>
      id === 0 ? { ...r, wireAgeMs: 1450 } : r,
    ),
  };
  expect(
    createControl(state, learning, profile, intent, 50).rpmExpiresMonoMs,
  ).toBe(100);
  expect(createControl(state, learning, profile, intent, 100).mode).toBe(
    "muted",
  );
});
test.each([{ enabled: false }, { routeMuted: true }, { interrupted: true }])(
  "intent latch %j keeps sound muted",
  (change) => {
    expect(
      createControl(live(), learning, profile, { ...intent, ...change }, 0)
        .mode,
    ).toBe("muted");
  },
);
test("whole-stream expiry and disconnect override otherwise fresh samples", () => {
  expect(createControl(live(), learning, profile, intent, 1000).reason).toBe(
    "stream",
  );
  expect(
    createControl(
      { ...live(), connection: "disconnected" },
      learning,
      profile,
      intent,
      0,
    ).reason,
  ).toBe("disconnected");
});

test("load and RPM crossfades preserve power before loudness trims with fixed peak headroom", () => {
  const at = (mappedRpm: number, pedal: number) =>
    createControl(
      live(
        800 +
          ((mappedRpm - profile.idleRpm) /
            (profile.maximumRpm - profile.idleRpm)) *
            4200,
        0,
        pedal,
      ),
      learning,
      profile,
      intent,
      0,
    ).layers;
  const powerBeforeTrims = (layers: ReturnType<typeof at>) =>
    layers.reduce((power, layer) => {
      const trim =
        10 **
        (profile.layers.find((source) => source.id === layer.layerId)!.gainDb /
          20);
      return power + (layer.gain / trim) ** 2;
    }, 0);
  const reference = powerBeforeTrims(at(2500, 0));
  for (const rpm of [
    1270, 1600, 1700, 2500, 3400, 4000, 5000, 6500, 7500, 8500,
  ]) {
    for (const pedal of [0, 25, 50, 75, 100]) {
      const layers = at(rpm, pedal);
      expect(powerBeforeTrims(layers)).toBeCloseTo(reference, 9);
      expect(
        layers.reduce((sum, layer) => sum + layer.gain, 0),
      ).toBeLessThanOrEqual(0.600001);
    }
  }
});

test("equal-energy synthetic layers keep midpoint energy across load and RPM overlaps", () => {
  const synthetic: SoundProfile = {
    ...profile,
    layers: profile.layers.map((layer) => ({ ...layer, gainDb: 0 })),
  };
  const energies = [0, 25, 50, 75, 100].map((pedal) =>
    createControl(
      live(2500, 0, pedal),
      learning,
      synthetic,
      intent,
      0,
    ).layers.reduce((sum, layer) => sum + layer.gain ** 2, 0),
  );
  for (const energy of energies) expect(energy).toBeCloseTo(energies[0]!, 12);
});

test("a late but valid RPM sample stays audible through the short-gap grace period", () => {
  const state = live(2500, 700);
  const control = createControl(state, learning, profile, intent, 0);
  expect(control.mode).toBe("pedal");
  expect(control.rpmExpiresMonoMs).toBe(800);
  state.snapshot = {
    ...state.snapshot!,
    receivedMonoMs: 300,
    readings: state.snapshot!.readings.map((reading, id) =>
      id === 0 ? { ...reading, wireAgeMs: 1000 } : reading,
    ),
  };
  expect(
    createControl(state, learning, profile, intent, 300).rpmExpiresMonoMs,
  ).toBe(800);
  expect(createControl(state, learning, profile, intent, 799).mode).toBe(
    "pedal",
  );
  expect(createControl(state, learning, profile, intent, 800).reason).toBe(
    "rpm",
  );
});
