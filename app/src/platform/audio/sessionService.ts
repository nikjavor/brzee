import { Platform } from "react-native";
import { requireNativeModule } from "expo-modules-core";
interface SessionModule {
  requestAudioFocus(): Promise<boolean>;
  releaseAudioFocus(): Promise<void>;
  update(connected: boolean, audible: boolean): Promise<void>;
  addListener(
    name: string,
    callback: (event: { type?: string; shouldResume?: boolean }) => void,
  ): { remove(): void };
}
let module: SessionModule | null = null;
const native = () =>
  (module ??= requireNativeModule<SessionModule>("BrzeeSession"));
export async function updateSessionService(
  connected: boolean,
  audible: boolean,
): Promise<void> {
  if (Platform.OS === "android") await native().update(connected, audible);
}
export function observeSessionStop(callback: () => void): () => void {
  if (Platform.OS !== "android") return () => {};
  const subscription = native().addListener("sessionStopped", callback);
  return () => subscription.remove();
}
export function observeAndroidRouteRemoval(callback: () => void): () => void {
  if (Platform.OS !== "android") return () => {};
  const subscription = native().addListener("routeRemoved", callback);
  return () => subscription.remove();
}
export async function requestSessionAudioFocus(): Promise<boolean> {
  return Platform.OS === "android" ? native().requestAudioFocus() : true;
}
export async function releaseSessionAudioFocus(): Promise<void> {
  if (Platform.OS === "android") await native().releaseAudioFocus();
}
export function observeAndroidFocus(events: {
  permanentLoss(): void;
  interruption(type: "began" | "ended", resume: boolean): void;
}): () => void {
  if (Platform.OS !== "android") return () => {};
  const subscriptions = [
    native().addListener("focusLost", () => events.permanentLoss()),
    native().addListener("focusInterruption", (event) => {
      if (event.type === "began" || event.type === "ended")
        events.interruption(event.type, Boolean(event.shouldResume));
    }),
  ];
  return () => {
    for (const s of subscriptions) s.remove();
  };
}
