import {
  AudioContext,
  AudioParam,
  AudioBufferSourceNode,
  GainNode,
} from "react-native-audio-api";
import { Asset } from "expo-asset";
import { SoundProfile } from "../../core/audio/types";
import { AudioControl } from "../../core/audio/control";
import { GainPoint, planEnvelope } from "../../core/audio/envelope";
import { loopTimes } from "../../core/audio/profile";
import { seamlessLoop } from "../../core/audio/loop";
import { soundAssets } from "./assets";

export function scheduleGain(
  param: AudioParam,
  points: GainPoint[],
  now: number,
): void {
  param.cancelAndHoldAtTime(now);
  for (const point of points)
    param.linearRampToValueAtTime(
      point.value,
      Math.max(now, point.timeSeconds),
    );
}
export class NativeGraph {
  readonly context = new AudioContext();
  private master = this.context.createGain();
  private layers = new Map<
    string,
    { source: AudioBufferSourceNode; gain: GainNode }
  >();
  private lastMuted = true;
  private constructor(readonly profile: SoundProfile) {
    this.master.gain.value = 0;
    this.master.connect(this.context.destination);
  }
  static async prepare(profile: SoundProfile): Promise<NativeGraph> {
    const graph = new NativeGraph(profile);
    try {
      for (const layer of profile.layers) {
        const asset = Asset.fromModule(soundAssets[layer.file]!);
        await asset.downloadAsync();
        const decoded = await graph.context.decodeAudioData(
          asset.localUri ?? asset.uri,
        );
        const times = loopTimes(layer, decoded.sampleRate);
        const length = times.endDecodedFrame - times.startDecodedFrame;
        const overlap = Math.min(
          Math.round(0.02 * decoded.sampleRate),
          Math.floor(length / 4),
        );
        const buffer = graph.context.createBuffer(
          decoded.numberOfChannels,
          length - overlap,
          decoded.sampleRate,
        );
        for (let channel = 0; channel < decoded.numberOfChannels; channel++)
          buffer.copyToChannel(
            seamlessLoop(
              decoded.getChannelData(channel),
              times.startDecodedFrame,
              times.endDecodedFrame,
              overlap,
            ),
            channel,
          );
        const source = graph.context.createBufferSource({
            pitchCorrection: false,
          }),
          gain = graph.context.createGain();
        source.buffer = buffer;
        source.loop = true;
        source.loopStart = 0;
        source.loopEnd = buffer.duration;
        gain.gain.value = 0;
        source.connect(gain);
        gain.connect(graph.master);
        graph.layers.set(layer.id, { source, gain });
      }
      const start = graph.context.currentTime + 0.03;
      for (const layer of graph.layers.values()) layer.source.start(start);
      return graph;
    } catch (error) {
      await graph.release();
      throw error;
    }
  }
  apply(control: AudioControl, nowMonoMs: number): void {
    const muted = control.mode === "muted";
    if (muted && this.lastMuted && control.reason !== "interruption") return;
    this.lastMuted = muted;
    const now = this.context.currentTime,
      envelope = planEnvelope(control, nowMonoMs, now);
    scheduleGain(this.master.gain, envelope.master, now);
    for (const target of control.layers) {
      const layer = this.layers.get(target.layerId);
      if (!layer) continue;
      scheduleGain(layer.gain.gain, envelope.layers[target.layerId] ?? [], now);
      layer.source.playbackRate.cancelAndHoldAtTime(now);
      layer.source.playbackRate.linearRampToValueAtTime(
        target.rate,
        now + 0.12,
      );
    }
  }
  async suspend(): Promise<void> {
    const now = this.context.currentTime;
    // Clear any route/user fade before the native clock stops advancing.
    scheduleGain(this.master.gain, [{ timeSeconds: now, value: 0 }], now);
    this.lastMuted = true;
    await this.context.suspend();
  }
  async release(): Promise<void> {
    for (const layer of this.layers.values()) {
      try {
        layer.source.stop();
      } catch {}
      layer.source.disconnect();
      layer.gain.disconnect();
    }
    this.layers.clear();
    await this.context.close();
  }
  async fadeAndRelease(): Promise<void> {
    const now = this.context.currentTime;
    scheduleGain(this.master.gain, [{ timeSeconds: now + 0.2, value: 0 }], now);
    await new Promise<void>((resolve) => setTimeout(resolve, 220));
    await this.release();
  }
}
