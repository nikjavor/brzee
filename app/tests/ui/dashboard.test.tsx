import { render, screen, fireEvent, act } from "@testing-library/react-native";
import { DashboardScreen } from "../../src/features/dashboard/DashboardScreen";
import { RuntimeProvider } from "../../src/app/RuntimeContext";
import { DriveRuntime } from "../../src/app/DriveRuntime";
import metadata from "../../assets/sounds/911-gt3-rs/profile.json";
import { SoundProfile } from "../../src/core/audio/types";
function setup() {
  let now = 0;
  const runtime = new DriveRuntime(
    {
      scan: async () => [],
      connect: async () => {},
      disconnect: async () => {},
    },
    {
      prepare: async () => {},
      suspend: async () => {},
      apply: () => {},
      release: async () => {},
    },
    { nowMs: () => now },
    metadata as SoundProfile,
  );
  runtime.store.setConnection("waiting");
  for (const t of [0, 100, 200]) {
    now = t;
    runtime.store.publish({
      sequence: t,
      capturedUptimeMs: t,
      receivedMonoMs: t,
      readings: Array.from({ length: 35 }, (_, id) => ({
        valid: id === 0 || id === 34,
        raw: id === 0 ? 2000 : id === 34 ? -86 : 0,
        wireAgeMs: 0,
      })),
    });
  }
  return {
    runtime,
    time: (t: number) => {
      now = t;
      runtime.tick();
    },
  };
}
test("unavailable speed and pedal stay unavailable; signed torque and RPM-only mode remain honest", async () => {
  const { runtime } = setup();
  await runtime.enableSound();
  await render(
    <RuntimeProvider runtime={runtime}>
      <DashboardScreen />
    </RuntimeProvider>,
  );
  expect(screen.getByLabelText("Speed unavailable")).toBeTruthy();
  expect(screen.getByLabelText(/Pedal.* unavailable/)).toBeTruthy();
  expect(screen.getByText("RPM-only sound")).toBeTruthy();
  expect(screen.getByText(/-86/)).toBeTruthy();
});
test("stream expiry removes live status; controls mute, set volume, and open profile", async () => {
  const { runtime, time } = setup();
  await runtime.enableSound();
  await render(
    <RuntimeProvider runtime={runtime}>
      <DashboardScreen />
    </RuntimeProvider>,
  );
  expect(screen.getByText("LIVE")).toBeTruthy();
  await act(async () => time(1200));
  expect(screen.queryByText("LIVE")).toBeNull();
  expect(screen.getByText("STALE")).toBeTruthy();
  await fireEvent.press(screen.getByRole("button", { name: "Mute sound" }));
  expect(runtime.getState().enabled).toBe(false);
  await fireEvent(screen.getByLabelText("Engine volume"), "valueChange", 0.3);
  expect(runtime.getState().volume).toBe(0.3);
  await fireEvent.press(
    screen.getByRole("button", { name: "Sound profile, 911 GT3 RS" }),
  );
  expect(screen.getByText("Sound profile")).toBeTruthy();
});
test("reset in vehicle settings mutes sound and restores the initial working scale", async () => {
  const { runtime } = setup();
  runtime.learning.saved = { ...runtime.learning.saved, rpmCeiling: 6500 };
  runtime.tick();
  await runtime.enableSound();
  await render(
    <RuntimeProvider runtime={runtime}>
      <DashboardScreen />
    </RuntimeProvider>,
  );
  await fireEvent.press(
    screen.getByRole("button", { name: "Vehicle settings" }),
  );
  await fireEvent.press(
    screen.getByRole("button", { name: "Reset vehicle learning" }),
  );
  expect(runtime.getState().rpmCeiling).toBe(5000);
  expect(runtime.getState().enabled).toBe(false);
});
