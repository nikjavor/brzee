import { AppState } from "react-native";
import { useEffect } from "react";
import { runtime } from "./runtime";
import { observeAudioLifecycle } from "../platform/audio/lifecycle";
import {
  observeSessionStop,
  observeAndroidRouteRemoval,
  observeAndroidFocus,
  updateSessionService,
} from "../platform/audio/sessionService";
import { AppShell } from "./AppShell";

export default function BrzeeApp() {
  useEffect(() => {
    const timer = setInterval(() => runtime.tick(), 100);
    void runtime.initialize();
    const appState = AppState.addEventListener("change", (state) => {
      if (state === "active") runtime.foreground();
      else void runtime.flushVehicle();
    });
    const stopLifecycle = observeAudioLifecycle({
      interruption: (type, resume) => runtime.interruption(type, resume),
      routeRemoved: () => runtime.routeRemoved(),
      routeAvailable: () => runtime.sound.routeAvailable(),
    });
    const stopService = observeSessionStop(() => {
      void runtime.disconnect();
    });
    const stopAndroidRoutes = observeAndroidRouteRemoval(() =>
      runtime.routeRemoved(),
    );
    const stopAndroidFocus = observeAndroidFocus({
      permanentLoss: () => runtime.interruption("ended", false),
      interruption: (type, resume) => runtime.interruption(type, resume),
    });
    let serviceKey = "";
    const updateService = () => {
      const connected = ["waiting", "connected", "disconnected"].includes(
        runtime.store.getState().connection,
      );
      const audible = runtime.getState().enabled;
      const key = `${connected}:${audible}`;
      if (key === serviceKey) return;
      serviceKey = key;
      void updateSessionService(connected, audible).catch((error) => {
        runtime.reportError(`Background session unavailable: ${String(error)}`);
        runtime.muteSound();
      });
    };
    const unsubStore = runtime.store.subscribe(updateService),
      unsubSound = runtime.subscribe(updateService);
    if (__DEV__) {
      Object.assign(globalThis, { __BRZEE_DEV__: runtime });
      import("../diagnostics/audioProbe")
        .then(({ runAudioProbe }) => runAudioProbe())
        .then((result) => console.info("BRZEE native envelope probe", result))
        .catch((error) =>
          console.error("BRZEE native envelope probe failed", error),
        );
    }
    return () => {
      clearInterval(timer);
      appState.remove();
      stopLifecycle();
      stopService();
      stopAndroidRoutes();
      stopAndroidFocus();
      unsubStore();
      unsubSound();
      runtime.muteSound();
    };
  }, []);
  return <AppShell runtime={runtime} />;
}
