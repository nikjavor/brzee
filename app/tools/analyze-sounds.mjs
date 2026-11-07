import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import path from "node:path";
export function spectralPeaks(samples, rate, start) {
  const n = 8192,
    step = 4,
    re = new Float64Array(n),
    im = new Float64Array(n),
    outputRate = rate / step;
  for (let i = 0; i < n; i++) {
    let v = 0;
    for (let k = 0; k < step; k++) v += samples[start + i * step + k] ?? 0;
    re[i] = (v / step) * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1)));
  }
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) [re[i], re[j]] = [re[j], re[i]];
  }
  for (let len = 2; len <= n; len *= 2)
    for (let offset = 0; offset < n; offset += len)
      for (let j = 0; j < len / 2; j++) {
        const a = (-2 * Math.PI * j) / len,
          c = Math.cos(a),
          s = Math.sin(a),
          k = offset + j,
          l = k + len / 2;
        const r = re[l] * c - im[l] * s,
          t = re[l] * s + im[l] * c;
        re[l] = re[k] - r;
        im[l] = im[k] - t;
        re[k] += r;
        im[k] += t;
      }
  const powers = Float64Array.from(
      { length: n / 2 },
      (_, i) => re[i] ** 2 + im[i] ** 2,
    ),
    peaks = [];
  for (
    let i = Math.ceil((25 * n) / outputRate);
    i < (1000 * n) / outputRate;
    i++
  )
    if (powers[i] > powers[i - 1] && powers[i] >= powers[i + 1]) {
      const a = Math.log(powers[i - 1] + 1e-12),
        b = Math.log(powers[i] + 1e-12),
        c = Math.log(powers[i + 1] + 1e-12);
      const fractional = (0.5 * (a - c)) / (a - 2 * b + c);
      peaks.push({
        hz: Math.round((((i + fractional) * outputRate) / n) * 100) / 100,
        power: powers[i],
      });
    }
  return peaks.sort((a, b) => b.power - a.power).slice(0, 12);
}

export function readWav(bytes) {
  if (
    bytes.toString("ascii", 0, 4) !== "RIFF" ||
    bytes.toString("ascii", 8, 12) !== "WAVE"
  )
    throw new Error("Expected RIFF WAVE");
  let format, data;
  for (let offset = 12; offset + 8 <= bytes.length;) {
    const name = bytes.toString("ascii", offset, offset + 4),
      size = bytes.readUInt32LE(offset + 4),
      start = offset + 8;
    if (start + size > bytes.length) throw new Error("Truncated WAV chunk");
    if (name === "fmt ")
      format = {
        encoding: bytes.readUInt16LE(start),
        channels: bytes.readUInt16LE(start + 2),
        sampleRate: bytes.readUInt32LE(start + 4),
        bits: bytes.readUInt16LE(start + 14),
      };
    if (name === "data") data = { start, size };
    offset = start + size + (size % 2);
  }
  if (
    !format ||
    !data ||
    format.encoding !== 1 ||
    format.bits !== 16 ||
    format.channels !== 2
  )
    throw new Error("Expected stereo PCM16");
  const frames = data.size / 4;
  if (!Number.isInteger(frames)) throw new Error("Incomplete sample frame");
  const channels = Array.from({ length: 2 }, (_, c) =>
    Float32Array.from(
      { length: frames },
      (_, i) => bytes.readInt16LE(data.start + i * 4 + c * 2) / 32768,
    ),
  );
  return { ...format, frames, dataOffset: data.start, channels };
}

function rms(samples, start, end) {
  let sum = 0;
  for (let i = start; i < end; i++) sum += samples[i] ** 2;
  return Math.sqrt(sum / Math.max(1, end - start));
}
function periodicity(samples, sampleRate, start, length, minRpm, maxRpm) {
  const step = 10,
    rate = sampleRate / step,
    n = Math.min(8000, Math.floor(length / step));
  const data = Float32Array.from({ length: n }, (_, i) => {
    let sum = 0;
    for (let j = 0; j < step; j++) sum += samples[start + i * step + j] ?? 0;
    return sum / step;
  });
  const mean = data.reduce((s, v) => s + v, 0) / n;
  for (let i = 0; i < n; i++) data[i] -= mean;
  const low = Math.max(2, Math.floor(rate / (maxRpm / 20))),
    high = Math.min(n / 4, Math.ceil(rate / (minRpm / 20)));
  const candidates = [];
  for (let lag = low; lag <= high; lag++) {
    let dot = 0,
      a = 0,
      b = 0;
    for (let i = lag; i < n; i++) {
      dot += data[i] * data[i - lag];
      a += data[i] ** 2;
      b += data[i - lag] ** 2;
    }
    candidates.push({
      lag,
      correlation: dot / Math.max(1e-12, Math.sqrt(a * b)),
      rpm: Math.round((rate / lag) * 20),
    });
  }
  return candidates
    .filter(
      (v, i) =>
        v.correlation > (candidates[i - 1]?.correlation ?? -1) &&
        v.correlation >= (candidates[i + 1]?.correlation ?? -1),
    )
    .sort((a, b) => b.correlation - a.correlation)
    .slice(0, 5);
}
export function analyze(file, bytes) {
  const wav = readWav(bytes),
    { channels, sampleRate, frames } = wav,
    left = channels[0];
  const blocks = [];
  for (let start = 0; start + sampleRate <= frames; start += sampleRate)
    blocks.push({
      startFrame: start,
      rms: rms(left, start, start + sampleRate),
    });
  const windows = [];
  const length = Math.min(
    Math.floor(sampleRate * 2),
    frames - Math.floor(sampleRate * 0.25),
  );
  for (
    let start = Math.floor(sampleRate * 0.1);
    start + length < frames;
    start += Math.floor(sampleRate * 0.25)
  ) {
    const values = Array.from({ length: 8 }, (_, i) =>
      rms(
        left,
        start + Math.floor((i * length) / 8),
        start + Math.floor(((i + 1) * length) / 8),
      ),
    );
    const mean = values.reduce((a, b) => a + b, 0) / 8;
    windows.push({
      start,
      score:
        Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / 8) /
        Math.max(mean, 1e-8),
    });
  }
  const stable = windows.sort((a, b) => a.score - b.score)[0] ?? {
    start: 0,
    score: 1,
  };
  const start = stable.start,
    endGuess = Math.min(frames - 256, start + length);
  let end = endGuess,
    best = Infinity;
  // Match both channels over 128 samples, rather than picking a zero crossing in one channel.
  for (
    let candidate = endGuess - Math.floor(sampleRate * 0.03);
    candidate <=
    Math.min(frames - 128, endGuess + Math.floor(sampleRate * 0.03));
    candidate++
  ) {
    let mismatch = 0;
    for (const ch of channels)
      for (let i = 0; i < 128; i++)
        mismatch += (ch[start + i] - ch[candidate + i]) ** 2;
    if (mismatch < best) {
      best = mismatch;
      end = candidate;
    }
  }
  let peak = 0,
    sum = 0;
  for (const ch of channels)
    for (const value of ch) {
      peak = Math.max(peak, Math.abs(value));
      sum += value * value;
    }
  const ranges = file.includes("idle")
    ? [600, 1600]
    : file.includes("veryhigh")
      ? [6500, 9500]
      : file.includes("high")
        ? [5000, 8000]
        : file.includes("mid")
          ? [3000, 5500]
          : [1600, 3600];
  return {
    file,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    channels: 2,
    sampleRate,
    bits: 16,
    frameCount: frames,
    dataOffset: wav.dataOffset,
    durationSeconds: frames / sampleRate,
    rms: Math.sqrt(sum / (frames * 2)),
    peak,
    loopStartFrame: start,
    loopEndFrame: end,
    stableRmsVariation: stable.score,
    seamRmsDifference: Math.sqrt(best / 256),
    spectralPeaks: spectralPeaks(left, sampleRate, start),
    periodicityHypotheses: periodicity(
      left,
      sampleRate,
      start,
      end - start,
      ...ranges,
    ),
    blocks,
  };
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const directory = path.resolve("assets/sounds/911-gt3-rs");
  const recordings = readdirSync(directory)
    .filter((f) => f.endsWith(".wav"))
    .sort()
    .map((file) => analyze(file, readFileSync(path.join(directory, file))));
  const result = {
    method:
      "PCM16 RIFF chunk parse; stereo seam matching; stable RMS window; autocorrelation with six-cylinder 3-firing/revolution hypothesis and layer-range priors. Acoustic RPM is estimated, not verified.",
    recordings,
  };
  writeFileSync(
    path.join(directory, "audit.json"),
    JSON.stringify(result, null, 2) + "\n",
  );
  console.table(
    recordings.map(
      ({
        file,
        durationSeconds,
        loopStartFrame,
        loopEndFrame,
        seamRmsDifference,
        periodicityHypotheses,
      }) => ({
        file,
        durationSeconds,
        loopStartFrame,
        loopEndFrame,
        seamRmsDifference,
        rpm: periodicityHypotheses[0]?.rpm,
        correlation: periodicityHypotheses[0]?.correlation,
      }),
    ),
  );
}
