import { AudioManager } from "react-native-audio-api";
import { Platform } from "react-native";
export interface AudioEvents {
  interruption(type: "began" | "ended", resume: boolean): void;
  routeRemoved(): void;
  routeAvailable(): void;
}
export function observeAudioLifecycle(events: AudioEvents): () => void {
  if (Platform.OS === "ios") AudioManager.observeAudioInterruptions(true);
  const subscriptions = [
    AudioManager.addSystemEventListener("interruption", (event) => {
      if (Platform.OS === "ios")
        events.interruption(event.type, event.shouldResume);
    }),
    AudioManager.addSystemEventListener("routeChange", (event) => {
      if (
        event.reason === "OldDeviceUnavailable" ||
        event.reason === "NoSuitableRouteForCategory"
      )
        events.routeRemoved();
      else if (event.reason === "NewDeviceAvailable") events.routeAvailable();
    }),
  ];
  return () => {
    for (const s of subscriptions) s.remove();
    AudioManager.observeAudioInterruptions(false);
  };
}
