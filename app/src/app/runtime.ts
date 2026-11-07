import { NativeBleTransport } from "../platform/ble/transport";
import { DriveRuntime } from "./DriveRuntime";
import { AudioEngine } from "../platform/audio/engine";
import { gt3Profile } from "../platform/audio/assets";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { VehicleRepository } from "../core/vehicle/storage";
import { PreferencesRepository } from "../core/vehicle/preferences";

export const clock = { nowMs: () => performance.now() };
export const runtime = new DriveRuntime(
  new NativeBleTransport(),
  new AudioEngine(),
  clock,
  gt3Profile,
  new VehicleRepository(AsyncStorage, (error) =>
    runtime.reportError(`Could not save vehicle: ${String(error)}`),
  ),
  new PreferencesRepository(AsyncStorage, (error) =>
    runtime.reportError(`Could not save preferences: ${String(error)}`),
  ),
);
