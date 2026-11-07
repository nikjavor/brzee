import { DriveRuntime, AudioBackend } from "../../src/app/DriveRuntime";
import { AudioControl } from "../../src/core/audio/control";
import { SoundProfile } from "../../src/core/audio/types";
import metadata from "../../assets/sounds/911-gt3-rs/profile.json";
import { BleTransport } from "../../src/platform/ble/types";
const transport: BleTransport = {
  scan: async () => [],
  connect: async () => {},
  disconnect: async () => {},
};
class Renderer implements AudioBackend {
  rendered: AudioControl[] = [];
  ready: () => Promise<void> = async () => {};
  prepare() {
    return this.ready();
  }
  apply(control: AudioControl) {
    this.rendered.push(control);
  }
  async suspend() {}
  async release() {}
}
function setup() {
  let now = 0;
  const renderer = new Renderer(),
    runtime = new DriveRuntime(
      transport,
      renderer,
      { nowMs: () => now },
      metadata as SoundProfile,
    );
  return {
    runtime,
    renderer,
    time: (value: number) => {
      now = value;
    },
  };
}
test("manual mute during preparation cannot revive sound when loading completes", async () => {
  const { runtime, renderer } = setup();
  let release!: () => void;
  renderer.ready = () =>
    new Promise<void>((resolve) => {
      release = resolve;
    });
  const pending = runtime.enableSound();
  expect(runtime.getState().loading).toBe(true);
  runtime.muteSound();
  release();
  await pending;
  expect(runtime.getState().enabled).toBe(false);
  expect(renderer.rendered.some((c) => c.mode !== "muted")).toBe(false);
});
test("unplugging output while sound loads clears preparation and requires explicit re-enable", async () => {
  const { runtime, renderer } = setup();
  let complete!: () => void;
  renderer.ready = () => new Promise<void>((resolve) => { complete = resolve; });
  const pending = runtime.enableSound();
  expect(runtime.getState().loading).toBe(true);
  runtime.routeRemoved();
  expect(runtime.getState().loading).toBe(false);
  expect(runtime.getState().enabled).toBe(false);
  expect(runtime.getState().reason).toBe("route");
  complete();
  await pending;
  expect(runtime.getState().enabled).toBe(false);
  expect(runtime.getState().loading).toBe(false);
});
test("complete telemetry drives sound only after recovery; elapsed freshness fades without another frame", async () => {
  const { runtime, renderer, time } = setup();
  await runtime.enableSound();
  runtime.store.setConnection("waiting");
  for (const t of [0, 100, 200]) {
    time(t);
    runtime.store.publish({
      sequence: t,
      capturedUptimeMs: t,
      receivedMonoMs: t,
      readings: Array.from({ length: 35 }, (_, id) => ({
        valid: id === 0,
        raw: id === 0 ? 2000 : 0,
        wireAgeMs: 0,
      })),
    });
  }
  expect(renderer.rendered.at(-1)?.mode).toBe("rpm-only");
  expect(renderer.rendered.at(-1)?.rpmExpiresMonoMs).toBe(1700);
  time(800);
  runtime.tick();
  expect(renderer.rendered.at(-1)?.mode).toBe("rpm-only");
  time(1200);
  runtime.tick();
  expect(renderer.rendered.at(-1)?.mode).toBe("muted");
});

test("call recovery serializes backend suspension and preparation and still requires fresh input", async () => {
  const { runtime, renderer, time } = setup();
  const calls: string[] = [];
  renderer.ready = async () => {
    calls.push("prepare");
  };
  Object.assign(renderer, {
    suspend: async () => {
      calls.push("suspend");
    },
  });
  await runtime.enableSound();
  calls.length = 0;
  runtime.interruption("began", false);
  await Promise.resolve();
  expect(calls).toEqual(["suspend"]);
  expect(renderer.rendered.at(-1)?.reason).toBe("interruption");
  runtime.interruption("ended", true);
  await Promise.resolve();
  await Promise.resolve();
  expect(calls).toEqual(["suspend", "prepare"]);
  expect(runtime.getState().enabled).toBe(true);
  expect(renderer.rendered.at(-1)?.mode).toBe("muted");
  runtime.store.setConnection("waiting");
  for (const t of [0, 100, 200]) {
    time(t);
    runtime.store.publish({
      sequence: t,
      capturedUptimeMs: t,
      receivedMonoMs: t,
      readings: Array.from({ length: 35 }, (_, id) => ({
        valid: id === 0,
        raw: id === 0 ? 2000 : 0,
        wireAgeMs: 0,
      })),
    });
  }
  expect(renderer.rendered.at(-1)?.mode).toBe("rpm-only");
});

test("route removal during delayed call recovery cannot revive sound after fresh telemetry", async () => {
  const { runtime, renderer, time } = setup();
  await runtime.enableSound();
  runtime.interruption("began", false);
  let release!: () => void;
  renderer.ready = () =>
    new Promise<void>((resolve) => {
      release = resolve;
    });
  runtime.interruption("ended", true);
  runtime.routeRemoved();
  release();
  await Promise.resolve();
  await Promise.resolve();
  runtime.store.setConnection("waiting");
  for (const t of [0, 100, 200]) {
    time(t);
    runtime.store.publish({
      sequence: t,
      capturedUptimeMs: t,
      receivedMonoMs: t,
      readings: Array.from({ length: 35 }, (_, id) => ({
        valid: id === 0,
        raw: id === 0 ? 2000 : 0,
        wireAgeMs: 0,
      })),
    });
  }
  expect(runtime.getState().enabled).toBe(false);
  expect(renderer.rendered.at(-1)?.reason).toBe("route");
});
