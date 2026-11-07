import { AudioManager } from "react-native-audio-api";
import { Platform } from "react-native";
import { SoundProfile } from "../../core/audio/types";
import { AudioControl } from "../../core/audio/control";
import { NativeGraph } from "./nativeGraph";
import {
  requestSessionAudioFocus,
  releaseSessionAudioFocus,
} from "./sessionService";
export class AudioEngine {
  private graph: NativeGraph | null = null;
  private focusHeld = false;
  private pending: Promise<void> = Promise.resolve();
  private enqueue(work: () => Promise<void>): Promise<void> {
    const result = this.pending.then(work, work);
    this.pending = result.catch(() => {});
    return result;
  }
  private async resumeGraph(graph: NativeGraph): Promise<void> {
    await graph.context.resume();
    // Audio API's public Promise discards the native success boolean.
    if (graph.context.state !== "running")
      throw new Error(
        "The native audio engine could not restart. Try enabling sound again.",
      );
  }
  async prepare(profile: SoundProfile): Promise<void> {
    return this.enqueue(async () => {
      if (Platform.OS === "android" && Number(Platform.Version) >= 33)
        await AudioManager.requestNotificationPermissions();
      if (Platform.OS === "android" && !this.focusHeld) {
        if (!(await requestSessionAudioFocus()))
          throw new Error(
            "Audio focus is unavailable. Try again after the other audio session ends.",
          );
        this.focusHeld = true;
      }
      AudioManager.setAudioSessionOptions({
        iosCategory: "playback",
        iosMode: "default",
        iosOptions: ["mixWithOthers"],
        iosNotifyOthersOnDeactivation: true,
      });
      await AudioManager.setAudioSessionActivity(true);
      if (this.graph?.profile.id === profile.id) {
        await this.resumeGraph(this.graph);
        return;
      }
      const graph = await NativeGraph.prepare(profile);
      const previous = this.graph;
      this.graph = graph;
      if (previous) await previous.fadeAndRelease();
      await this.resumeGraph(graph);
    });
  }
  async suspend(): Promise<void> {
    return this.enqueue(async () => {
      await this.graph?.suspend();
    });
  }
  apply(control: AudioControl, now: number): void {
    this.graph?.apply(control, now);
    if (
      Platform.OS === "android" &&
      this.focusHeld &&
      control.mode === "muted" &&
      (control.reason === "user" || control.reason === "route")
    ) {
      this.focusHeld = false;
      void this.enqueue(() => releaseSessionAudioFocus()).catch((error) =>
        console.error("BRZEE release focus", error),
      );
    }
  }
  async release(): Promise<void> {
    return this.enqueue(async () => {
      const graph = this.graph;
      this.graph = null;
      await graph?.fadeAndRelease();
      if (this.focusHeld) {
        this.focusHeld = false;
        await releaseSessionAudioFocus();
      }
      await AudioManager.setAudioSessionActivity(false);
    });
  }
}
