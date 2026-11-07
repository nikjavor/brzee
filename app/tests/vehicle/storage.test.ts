import {
  VehicleRepository,
  VEHICLE_KEY,
  parseVehicle,
  KeyValueStore,
} from "../../src/core/vehicle/storage";
import { defaultVehicle } from "../../src/core/vehicle/learning";
test("accepts only versioned bounded vehicle data; missing, corrupt and unknown schemas reset safely", () => {
  const saved = {
    ...defaultVehicle(),
    rpmCeiling: 6500,
    idleRpm: 810,
    pedalCalibration: { 19: { released: 10, pressed: 80 } },
  };
  expect(parseVehicle(JSON.stringify(saved))).toEqual(saved);
  for (const value of [
    null,
    "{",
    '{"schemaVersion":2}',
    JSON.stringify({ ...saved, rpmCeiling: NaN }),
    JSON.stringify({
      ...saved,
      pedalCalibration: { 19: { released: 80, pressed: 10 } },
    }),
  ])
    expect(parseVehicle(value)).toEqual(defaultVehicle());
});
test("a reset is serialized after an in-flight old write so old learning cannot return", async () => {
  const values = new Map<string, string>();
  let release!: () => void, started!: () => void;
  const began = new Promise<void>((resolve) => {
    started = resolve;
  });
  let first = true;
  const storage: KeyValueStore = {
    getItem: async (key) => values.get(key) ?? null,
    setItem: async (key, value) => {
      if (first) {
        first = false;
        started();
        await new Promise<void>((resolve) => {
          release = resolve;
        });
      }
      values.set(key, value);
    },
  };
  const repo = new VehicleRepository(storage);
  const old = repo.flush({ ...defaultVehicle(), rpmCeiling: 7000 });
  await began;
  const reset = repo.flush(defaultVehicle());
  release();
  await old;
  await reset;
  expect(JSON.parse(values.get(VEHICLE_KEY)!)).toEqual(defaultVehicle());
  expect(await repo.load()).toEqual(defaultVehicle());
});
