import { LearnedVehicle } from "./types";
import { defaultVehicle } from "./learning";
export interface KeyValueStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}
export const VEHICLE_KEY = "brzee.vehicle.v1";
export function parseVehicle(json: string | null): LearnedVehicle {
  try {
    if (!json) return defaultVehicle();
    const p = JSON.parse(json);
    if (
      !p ||
      p.schemaVersion !== 1 ||
      !Number.isInteger(p.rpmCeiling) ||
      p.rpmCeiling < 5000 ||
      p.rpmCeiling > 30000 ||
      p.rpmCeiling % 500 !== 0 ||
      (p.idleRpm !== null &&
        (!Number.isFinite(p.idleRpm) ||
          p.idleRpm <= 0 ||
          p.idleRpm >= p.rpmCeiling)) ||
      !p.pedalCalibration ||
      typeof p.pedalCalibration !== "object" ||
      Array.isArray(p.pedalCalibration)
    )
      return defaultVehicle();
    for (const [id, c] of Object.entries(p.pedalCalibration)) {
      const calibration = c as { released: number; pressed: number };
      if (
        !["16", "17", "18", "19"].includes(id) ||
        !calibration ||
        ![calibration.released, calibration.pressed].every(Number.isFinite) ||
        calibration.released < 0 ||
        calibration.pressed > 100 ||
        calibration.pressed - calibration.released < 5
      )
        return defaultVehicle();
    }
    return {
      schemaVersion: 1,
      rpmCeiling: p.rpmCeiling,
      idleRpm: p.idleRpm,
      pedalCalibration: p.pedalCalibration,
    };
  } catch {
    return defaultVehicle();
  }
}
export class VehicleRepository {
  private pending: string | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private writes: Promise<void> = Promise.resolve();
  constructor(
    readonly storage: KeyValueStore,
    readonly onError: (error: unknown) => void = () => {},
  ) {}
  async load(): Promise<LearnedVehicle> {
    return parseVehicle(await this.storage.getItem(VEHICLE_KEY));
  }
  schedule(value: LearnedVehicle): void {
    this.pending = JSON.stringify(value);
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      void this.flush().catch(this.onError);
    }, 500);
  }
  async flush(value?: LearnedVehicle): Promise<void> {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    if (value) this.pending = JSON.stringify(value);
    const json = this.pending;
    this.pending = null;
    if (json === null) return this.writes;
    const write = this.writes
      .catch(() => {})
      .then(() => this.storage.setItem(VEHICLE_KEY, json));
    this.writes = write;
    return write;
  }
}
