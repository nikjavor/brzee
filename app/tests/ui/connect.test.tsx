import { render, screen, fireEvent, act } from "@testing-library/react-native";
import { AppShell } from "../../src/app/AppShell";
import { DriveRuntime } from "../../src/app/DriveRuntime";
import { SoundProfile } from "../../src/core/audio/types";
import metadata from "../../assets/sounds/911-gt3-rs/profile.json";

jest.mock("react-native-safe-area-context", () =>
  jest.requireActual("react-native-safe-area-context/jest/mock").default,
);

test("the app starts muted with no telemetry and connects only to hardware", async () => {
  const transport = {
    scan: jest.fn(async () => [{ id: "board", name: "BRZEE", rssi: -40 }]),
    connect: jest.fn(async () => {}),
    disconnect: jest.fn(async () => {}),
  };
  const runtime = new DriveRuntime(
    transport,
    {
      prepare: async () => {},
      suspend: async () => {},
      apply: () => {},
      release: async () => {},
    },
    { nowMs: () => 0 },
    metadata as SoundProfile,
  );
  await render(<AppShell runtime={runtime} />);
  expect(runtime.store.getState().snapshot).toBeNull();
  expect(runtime.getState().enabled).toBe(false);
  expect(screen.queryByText(/demo|simulated/i)).toBeNull();
  expect(transport.scan).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole("button", { name: "Connect to BRZEE" }));
  expect(transport.scan).toHaveBeenCalledTimes(1);
  expect(transport.connect).toHaveBeenCalledWith(
    "board", expect.any(Function), expect.any(Function), expect.any(AbortSignal),
  );
  expect(runtime.store.getState().connection).toBe("waiting");
  expect(screen.getByText("WAITING")).toBeTruthy();
  expect(screen.getByLabelText("Speed unavailable")).toBeTruthy();
  expect(screen.queryByText("LIVE")).toBeNull();
  await act(async () => runtime.disconnect());
});
