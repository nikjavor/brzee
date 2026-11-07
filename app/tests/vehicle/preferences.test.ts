import {
  parsePreferences,
  defaultPreferences,
  validCoolant,
  PreferencesRepository,
} from "../../src/core/vehicle/preferences";
test("saves volume and configured coolant bounds without persisting sound-on intent", async () => {
  let saved: string | null = null;
  const repo = new PreferencesRepository({
    getItem: async () => saved,
    setItem: async (_key, value) => {
      saved = value;
    },
  });
  const p = {
    ...defaultPreferences(),
    volume: 0.3,
    coolant: { minimum: -20, maximum: 130, lowWarning: null, highWarning: 115 },
  };
  expect(parsePreferences(JSON.stringify(p))).toEqual(p);
  repo.save(p);
  await repo.flush();
  expect(await repo.load()).toEqual(p);
  expect(JSON.parse(saved!)).not.toHaveProperty("enabled");
});
test("rejects inverted bounds, out-of-range warning thresholds and corrupt preferences", () => {
  expect(
    validCoolant({
      minimum: -40,
      maximum: 150,
      lowWarning: null,
      highWarning: null,
    }),
  ).toBe(true);
  expect(
    validCoolant({
      minimum: 150,
      maximum: -40,
      lowWarning: null,
      highWarning: null,
    }),
  ).toBe(false);
  expect(
    validCoolant({
      minimum: -40,
      maximum: 150,
      lowWarning: 130,
      highWarning: 100,
    }),
  ).toBe(false);
  expect(parsePreferences("{bad")).toEqual(defaultPreferences());
});
test("an ordinary debounced preference write reports a storage failure", async () => {
  jest.useFakeTimers();
  const errors: unknown[] = [];
  const repo = new PreferencesRepository(
    {
      getItem: async () => null,
      setItem: async () => {
        throw new Error("Disk full");
      },
    },
    (error) => errors.push(error),
  );
  repo.save(defaultPreferences());
  await jest.advanceTimersByTimeAsync(500);
  expect(errors.map(String)).toEqual(["Error: Disk full"]);
  jest.useRealTimers();
});
