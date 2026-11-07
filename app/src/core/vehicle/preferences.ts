import { KeyValueStore } from "./storage";
export interface CoolantSettings {
  minimum: number;
  maximum: number;
  lowWarning: number | null;
  highWarning: number | null;
}
export interface Preferences {
  schemaVersion: 1;
  volume: number;
  profileId: string;
  coolant: CoolantSettings;
}
export const defaultPreferences = (): Preferences => ({
  schemaVersion: 1,
  volume: 0.5,
  profileId: "911-gt3-rs",
  coolant: { minimum: -40, maximum: 150, lowWarning: null, highWarning: null },
});
export function validCoolant(s: CoolantSettings): boolean {
  return (
    Boolean(s) &&
    [s.minimum, s.maximum].every(Number.isFinite) &&
    s.minimum >= -273 &&
    s.maximum <= 1000 &&
    s.maximum > s.minimum &&
    (s.lowWarning === null ||
      (Number.isFinite(s.lowWarning) &&
        s.lowWarning >= s.minimum &&
        s.lowWarning <= s.maximum)) &&
    (s.highWarning === null ||
      (Number.isFinite(s.highWarning) &&
        s.highWarning >= s.minimum &&
        s.highWarning <= s.maximum)) &&
    (s.lowWarning === null ||
      s.highWarning === null ||
      s.lowWarning < s.highWarning)
  );
}
export function parsePreferences(json: string | null): Preferences {
  try {
    const p = JSON.parse(json ?? "null");
    return p &&
      p.schemaVersion === 1 &&
      Number.isFinite(p.volume) &&
      p.volume >= 0 &&
      p.volume <= 1 &&
      p.profileId === "911-gt3-rs" &&
      validCoolant(p.coolant)
      ? {
          schemaVersion: 1,
          volume: p.volume,
          profileId: p.profileId,
          coolant: p.coolant,
        }
      : defaultPreferences();
  } catch {
    return defaultPreferences();
  }
}
export class PreferencesRepository {
  private pending: string | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private writes: Promise<void> = Promise.resolve();
  constructor(
    readonly storage: KeyValueStore,
    readonly onError: (error: unknown) => void = () => {},
  ) {}
  async load(): Promise<Preferences> {
    return parsePreferences(await this.storage.getItem("brzee.preferences.v1"));
  }
  save(preferences: Preferences): void {
    this.pending = JSON.stringify(preferences);
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      void this.flush().catch(this.onError);
    }, 500);
  }
  async flush(): Promise<void> {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    const value = this.pending;
    this.pending = null;
    if (value === null) return this.writes;
    const write = this.writes
      .catch(() => {})
      .then(() => this.storage.setItem("brzee.preferences.v1", value));
    this.writes = write;
    return write;
  }
}
