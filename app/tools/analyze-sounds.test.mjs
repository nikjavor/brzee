import { test } from "node:test";
import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { readWav, spectralPeaks } from "./analyze-sounds.mjs";
test("finds a synthetic 180Hz dominant without imposing a layer RPM prior", () => {
  const samples = Float32Array.from({ length: 44100 }, (_, i) =>
    Math.sin((2 * Math.PI * 180 * i) / 44100),
  );
  assert.ok(Math.abs(spectralPeaks(samples, 44100, 0)[0].hz - 180) < 3);
});
test("reads PCM after an odd-sized unknown chunk and rejects truncation", () => {
  const bytes = Buffer.alloc(58);
  bytes.write("RIFF");
  bytes.writeUInt32LE(50, 4);
  bytes.write("WAVE", 8);
  bytes.write("JUNK", 12);
  bytes.writeUInt32LE(1, 16);
  bytes[20] = 12;
  bytes.write("fmt ", 22);
  bytes.writeUInt32LE(16, 26);
  bytes.writeUInt16LE(1, 30);
  bytes.writeUInt16LE(2, 32);
  bytes.writeUInt32LE(44100, 34);
  bytes.writeUInt16LE(16, 44);
  bytes.write("data", 46);
  bytes.writeUInt32LE(4, 50);
  bytes.writeInt16LE(-16384, 54);
  bytes.writeInt16LE(8192, 56);
  const result = readWav(bytes);
  assert.equal(result.dataOffset, 54);
  assert.equal(result.channels[0][0], -0.5);
  assert.equal(result.channels[1][0], 0.25);
  assert.throws(() => readWav(bytes.subarray(0, 57)), /Truncated/);
});
