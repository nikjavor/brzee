import { BleSession } from "../../src/core/session/BleSession";
import { TelemetryStore } from "../../src/core/telemetry/store";
import { BleTransport } from "../../src/platform/ble/types";
test("permission/off errors remain retryable and multiple devices never select an arbitrary board", async () => {
  let scanCount = 0,
    connections = 0;
  const transport: BleTransport = {
    scan: async () => {
      if (scanCount++ < 2)
        throw new Error(
          scanCount === 1 ? "Permission denied" : "Bluetooth off",
        );
      return [
        { id: "a", name: "BRZEE", rssi: -40 },
        { id: "b", name: "BRZEE", rssi: -60 },
      ];
    },
    connect: async () => {
      connections++;
    },
    disconnect: async () => {},
  };
  const store = new TelemetryStore(),
    session = new BleSession(transport, store, { nowMs: () => 0 });
  await session.scan();
  expect(store.getState().connection).toBe("error");
  expect(session.getState().error).toMatch(/denied/);
  await session.scan();
  expect(session.getState().error).toMatch(/off/);
  const devices = await session.scan();
  expect(devices).toHaveLength(2);
  expect(store.getState().connection).toBe("selecting");
  expect(connections).toBe(0);
  await session.cancel();
});
test("subscription failures back off 1/2/4 seconds for the selected board; manual cancellation stops retries", async () => {
  jest.useFakeTimers();
  const attempts: string[] = [];
  const transport: BleTransport = {
    scan: async () => [],
    connect: async (id) => {
      attempts.push(id);
      throw new Error("Subscription failed");
    },
    disconnect: async () => {},
  };
  const session = new BleSession(transport, new TelemetryStore(), {
    nowMs: () => 0,
  });
  await session.connect("chosen");
  expect(attempts).toEqual(["chosen"]);
  await jest.advanceTimersByTimeAsync(1000);
  expect(attempts).toHaveLength(2);
  await jest.advanceTimersByTimeAsync(1999);
  expect(attempts).toHaveLength(2);
  await jest.advanceTimersByTimeAsync(1);
  expect(attempts).toHaveLength(3);
  await session.cancel();
  await jest.advanceTimersByTimeAsync(10000);
  expect(attempts).toEqual(["chosen", "chosen", "chosen"]);
  jest.useRealTimers();
});
