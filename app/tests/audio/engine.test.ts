import { AudioEngine } from "../../src/platform/audio/engine";
import { SoundProfile } from "../../src/core/audio/types";
import metadata from "../../assets/sounds/911-gt3-rs/profile.json";
const mockCalls: string[] = [];
const mockContext = {
  state: "running",
  suspend: jest.fn(async () => {
    mockCalls.push("suspend");
    mockContext.state = "suspended";
  }),
  resume: jest.fn(async () => {
    mockCalls.push("resume");
    if (mockContext.state === "suspended") mockCalls.push("engine:restart");
    mockContext.state = "running";
  }),
};
const mockGraph = {
  profile: metadata,
  context: mockContext,
  suspend: () => mockContext.suspend(),
  apply: jest.fn(),
  fadeAndRelease: jest.fn(async () => {}),
};
jest.mock("react-native-audio-api", () => ({
  AudioManager: {
    setAudioSessionOptions: jest.fn(),
    setAudioSessionActivity: jest.fn(async (active: boolean) => {
      mockCalls.push(`session:${active}`);
    }),
  },
}));
jest.mock("../../src/platform/audio/nativeGraph", () => ({
  NativeGraph: { prepare: jest.fn(async () => mockGraph) },
}));
jest.mock("../../src/platform/audio/sessionService", () => ({
  requestSessionAudioFocus: jest.fn(async () => true),
  releaseSessionAudioFocus: jest.fn(async () => {}),
}));
test("same-profile recovery explicitly suspends before reactivating and restarting the interrupted engine", async () => {
  const engine = new AudioEngine();
  await engine.prepare(metadata as SoundProfile);
  mockCalls.length = 0;
  // An iOS interruption stops the native driver while context state still says running.
  await engine.suspend();
  await engine.prepare(metadata as SoundProfile);
  expect(mockCalls).toEqual([
    "suspend",
    "session:true",
    "resume",
    "engine:restart",
  ]);
});

test("a rapid call end cannot restart the context before suspension completes", async () => {
  const engine = new AudioEngine();
  await engine.prepare(metadata as SoundProfile);
  mockCalls.length = 0;
  let release!: () => void;
  mockContext.suspend.mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        mockCalls.push("suspend:pending");
        release = () => {
          mockContext.state = "suspended";
          resolve();
        };
      }),
  );
  const pause = engine.suspend();
  const recovery = engine.prepare(metadata as SoundProfile);
  await Promise.resolve();
  expect(mockCalls).toEqual(["suspend:pending"]);
  release();
  await pause;
  await recovery;
  expect(mockCalls).toEqual([
    "suspend:pending",
    "session:true",
    "resume",
    "engine:restart",
  ]);
});

test("a failed native restart cannot be reported as ready sound", async () => {
  const engine = new AudioEngine();
  await engine.prepare(metadata as SoundProfile);
  await engine.suspend();
  // The library's public resume Promise discards its native boolean result.
  mockContext.resume.mockImplementationOnce(async () => {});
  await expect(engine.prepare(metadata as SoundProfile)).rejects.toThrow(
    "restart",
  );
});
