/** Standalone screenshot entry. Never imported by App.tsx or included in EAS uploads. */
import { registerRootComponent } from "expo";
import { useEffect } from "react";
import { Linking } from "react-native";
import { AppShell } from "../../src/app/AppShell";
import { DriveRuntime } from "../../src/app/DriveRuntime";
import { SoundProfile } from "../../src/core/audio/types";
import metadata from "../../assets/sounds/911-gt3-rs/profile.json";
import { BleTransport } from "../../src/platform/ble/types";

const scenes = {
  idle: { rpm: 820, speed: 0, coolant: 88, pedal: 0, torque: 18 },
  city: { rpm: 2450, speed: 48, coolant: 90, pedal: 28, torque: 92 },
  cruise: { rpm: 3200, speed: 96, coolant: 92, pedal: 42, torque: 134 },
};
let scene = scenes.city;
let sequence = 0;
let timer: ReturnType<typeof setInterval> | undefined;
function notification(): Uint8Array {
  const body = new Uint8Array(219), view = new DataView(body.buffer);
  view.setUint32(0, Math.floor(performance.now()) >>> 0, true);
  for (const [id, raw] of [
    [0, scene.rpm], [1, scene.speed], [2, scene.coolant],
    [19, scene.pedal], [34, scene.torque],
  ]) {
    body[4 + Math.floor(id! / 8)]! |= 1 << (id! % 8);
    view.setInt32(9 + id! * 6, raw!, true);
  }
  const current = sequence++ & 65535;
  return Uint8Array.from([1, current & 255, current >>> 8, 0, 1, ...body]);
}
const transport: BleTransport = {
  scan: async () => [{ id: "screenshot", name: "BRZEE", rssi: -42 }],
  connect: async (_id, bytes) => {
    bytes(notification());
    timer = setInterval(() => bytes(notification()), 100);
  },
  disconnect: async () => { clearInterval(timer); },
};
const runtime = new DriveRuntime(
  transport,
  { prepare: async () => {}, suspend: async () => {}, apply: () => {}, release: async () => {} },
  { nowMs: () => performance.now() },
  metadata as SoundProfile,
);

function selectScene(url: string | null | undefined) {
  const name = url?.split("/").pop();
  if (name && name in scenes) scene = scenes[name as keyof typeof scenes];
}
function ScreenshotApp() {
  useEffect(() => {
    const link = Linking.addEventListener("url", ({ url }) => selectScene(url));
    let active = true;
    void (async () => {
      selectScene(await Linking.getInitialURL());
      if (!active) return;
      await runtime.initialize();
      await runtime.connectDevice("screenshot");
      await runtime.enableSound();
    })();
    const tick = setInterval(() => runtime.tick(), 100);
    return () => {
      active = false;
      link.remove();
      clearInterval(tick);
      void runtime.disconnect();
    };
  }, []);
  return <AppShell runtime={runtime} />;
}
registerRootComponent(ScreenshotApp);
