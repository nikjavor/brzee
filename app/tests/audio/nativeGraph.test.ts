import { NativeGraph } from "../../src/platform/audio/nativeGraph";
import { SoundProfile } from "../../src/core/audio/types";
import metadata from "../../assets/sounds/911-gt3-rs/profile.json";
const mockCalls: unknown[][] = [];
jest.mock("react-native-audio-api", () => ({
  AudioContext: class {
    currentTime = 4;
    destination = {};
    createGain() {
      return {
        connect: jest.fn(),
        gain: {
          value: 0,
          cancelAndHoldAtTime: (time: number) => mockCalls.push(["hold", time]),
          linearRampToValueAtTime: (value: number, time: number) =>
            mockCalls.push(["gain", value, time]),
        },
      };
    }
    async suspend() {
      mockCalls.push(["suspend"]);
    }
  },
}));
test("interruption clears even a partially faded gain before freezing the native clock", async () => {
  const graph = await NativeGraph.prepare({
    ...metadata,
    layers: [],
  } as SoundProfile);
  await graph.suspend();
  expect(mockCalls).toEqual([["hold", 4], ["gain", 0, 4], ["suspend"]]);
});
