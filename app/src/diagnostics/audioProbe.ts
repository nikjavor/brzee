import { OfflineAudioContext } from "react-native-audio-api";
import { planEnvelope } from "../core/audio/envelope";
import { scheduleGain } from "../platform/audio/nativeGraph";
export async function runAudioProbe() {
  const context = new OfflineAudioContext(1, 48000, 48000),
    source = context.createOscillator(),
    gain = context.createGain();
  gain.gain.value = 0;
  source.frequency.value = 180;
  source.connect(gain);
  gain.connect(context.destination);
  const envelope = planEnvelope(
    {
      mode: "rpm-only",
      reason: null,
      layers: [],
      rpmOnlyLayers: [],
      rpmExpiresMonoMs: 100,
      streamExpiresMonoMs: 1000,
      pedalExpiresMonoMs: null,
      rampMs: 200,
    },
    0,
    0,
  );
  scheduleGain(gain.gain, envelope.master, 0);
  for (const now of [50, 90])
    scheduleGain(
      gain.gain,
      planEnvelope(
        {
          mode: "rpm-only",
          reason: null,
          layers: [],
          rpmOnlyLayers: [],
          rpmExpiresMonoMs: 100,
          streamExpiresMonoMs: 1000,
          pedalExpiresMonoMs: null,
          rampMs: 200,
        },
        now,
        now / 1000,
      ).master,
      now / 1000,
    );
  source.start(0);
  const rendered = await context.startRendering(),
    samples = rendered.getChannelData(0);
  const rms = (start: number, end: number) =>
    Math.sqrt(
      samples.slice(start, end).reduce((s, v) => s + v * v, 0) / (end - start),
    );
  const result = {
    beforeExpiryRms: rms(2400, 4320),
    afterExpiryRms: rms(19200, 38400),
    sampleRate: rendered.sampleRate,
  };
  if (result.beforeExpiryRms < 0.01 || result.afterExpiryRms > 1e-5)
    throw new Error(`Native envelope probe failed: ${JSON.stringify(result)}`);
  return result;
}
