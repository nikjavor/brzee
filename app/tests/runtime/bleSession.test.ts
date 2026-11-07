import { BleSession } from "../../src/core/session/BleSession";
import { TelemetryStore } from "../../src/core/telemetry/store";
import { BleTransport } from "../../src/platform/ble/types";
import golden from "../fixtures/v1/golden.json";

const frame = () =>
  Uint8Array.from([1, 1, 0, 0, 1, ...Buffer.from(golden.bodyHex, "hex")]);
class Radio implements BleTransport {
  waiters = new Map<number, () => void>();
  streams: {
    bytes: (bytes: Uint8Array) => void;
    drop: (error?: Error) => void;
    resolve: () => void;
    signal: AbortSignal;
  }[] = [];
  async scan() {
    return [{ id: "board", name: "BRZEE", rssi: -50 }];
  }
  connect(
    _id: string,
    bytes: (bytes: Uint8Array) => void,
    drop: (error?: Error) => void,
    signal: AbortSignal,
  ) {
    return new Promise<void>((resolve) => {
      this.streams.push({ bytes, drop, resolve, signal });
      this.waiters.get(this.streams.length - 1)?.();
    });
  }
  waitFor(index: number) {
    return this.streams[index]
      ? Promise.resolve()
      : new Promise<void>((resolve) => this.waiters.set(index, resolve));
  }
  async disconnect() {}
}
test("waits for a complete snapshot then publishes live; disconnect clears data", async () => {
  const radio = new Radio(),
    store = new TelemetryStore(),
    session = new BleSession(radio, store, { nowMs: () => 0 });
  const connected = session.connect("board");
  await radio.waitFor(0);
  expect(store.getState().snapshot).toBeNull();
  radio.streams[0]!.resolve();
  await connected;
  expect(store.getState().connection).toBe("waiting");
  radio.streams[0]!.bytes(Uint8Array.from([1, 1, 0, 0, 2, 10]));
  expect(store.getState().snapshot).toBeNull();
  const next = frame();
  next[1] = 2;
  radio.streams[0]!.bytes(next);
  expect(store.getState().connection).toBe("connected");
  expect(store.getState().snapshot?.readings[0]?.raw).toBe(3688);
  radio.streams[0]!.drop();
  expect(store.getState().connection).toBe("disconnected");
  expect(store.getState().snapshot).toBeNull();
  await session.cancel();
});
test("canceled and superseded callbacks cannot publish or reconnect into a new session", async () => {
  const radio = new Radio(),
    store = new TelemetryStore(),
    session = new BleSession(radio, store, { nowMs: () => 0 });
  const old = session.connect("old");
  await radio.waitFor(0);
  await session.cancel();
  const current = session.connect("new");
  await radio.waitFor(1);
  radio.streams[0]!.bytes(frame());
  radio.streams[0]!.drop();
  radio.streams[0]!.resolve();
  await old;
  expect(store.getState().snapshot).toBeNull();
  radio.streams[1]!.resolve();
  await current;
  radio.streams[1]!.bytes(frame());
  expect(store.getState().snapshot?.sequence).toBe(1);
  await session.cancel();
});
test("no first frame after five seconds yields actionable waiting state", async () => {
  jest.useFakeTimers();
  const radio = new Radio(),
    store = new TelemetryStore(),
    session = new BleSession(radio, store, { nowMs: () => 0 });
  const pending = session.connect("board");
  await radio.waitFor(0);
  radio.streams[0]!.resolve();
  await pending;
  jest.advanceTimersByTime(5000);
  expect(session.getState().message).toMatch(/telemetry/i);
  expect(store.getState().connection).toBe("waiting");
  await session.cancel();
  jest.useRealTimers();
});
test("drop invalidates late notifications and retries only the selected device after one second", async () => {
  jest.useFakeTimers();
  const radio = new Radio(),
    store = new TelemetryStore(),
    session = new BleSession(radio, store, { nowMs: () => 0 });
  const pending = session.connect("board");
  await radio.waitFor(0);
  radio.streams[0]!.resolve();
  await pending;
  radio.streams[0]!.bytes(frame());
  radio.streams[0]!.drop();
  radio.streams[0]!.bytes(frame());
  expect(store.getState().snapshot).toBeNull();
  jest.advanceTimersByTime(999);
  expect(radio.streams).toHaveLength(1);
  jest.advanceTimersByTime(1);
  await radio.waitFor(1);
  expect(store.getState().connection).toBe("connecting");
  radio.streams[0]!.bytes(frame());
  expect(store.getState().snapshot).toBeNull();
  await session.cancel();
  jest.advanceTimersByTime(30000);
  expect(radio.streams).toHaveLength(2);
  jest.useRealTimers();
});
test("cancel during native cleanup cannot start a connection afterwards", async () => {
  const radio = new Radio(),
    store = new TelemetryStore(),
    session = new BleSession(radio, store, { nowMs: () => 0 });
  let release!: () => void;
  let calls = 0;
  radio.disconnect = () =>
    ++calls === 1
      ? new Promise<void>((resolve) => {
          release = resolve;
        })
      : Promise.resolve();
  const pending = session.connect("board");
  await session.cancel();
  release();
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  expect(radio.streams).toHaveLength(0);
  await pending;
});
