export function seamlessLoop(
  samples: Float32Array,
  start: number,
  end: number,
  overlap: number,
): Float32Array<ArrayBuffer> {
  const fade = Math.max(
    2,
    Math.min(Math.floor(overlap), Math.floor((end - start) / 4)),
  );
  const output = Float32Array.from(samples.subarray(start + fade, end));
  for (let i = 0; i < fade; i++) {
    const t = (1 - Math.cos((Math.PI * i) / (fade - 1))) / 2,
      index = output.length - fade + i;
    output[index] = output[index]! * (1 - t) + samples[start + i]! * t;
  }
  return output;
}
