import { Platform } from "react-native";
import { observeAudioLifecycle } from "../../src/platform/audio/lifecycle";
const focusRequests: string[] = [];
jest.mock("react-native-audio-api", () => ({
  AudioManager: {
    observeAudioInterruptions: (focus: string | boolean) => {
      if (focus) focusRequests.push(String(focus));
    },
    addSystemEventListener: () => ({ remove: () => {} }),
  },
}));
test("installing listeners on a muted Android launch does not request audio focus", () => {
  const platform = jest.replaceProperty(Platform, "OS", "android");
  const cleanup = observeAudioLifecycle({
    interruption: () => {},
    routeRemoved: () => {},
    routeAvailable: () => {},
  });
  expect(focusRequests).toEqual([]);
  cleanup();
  platform.restore();
});
