import { seamlessLoop } from "../../src/core/audio/loop";
test("overlaps the tail and head into a continuous periodic seam without editing input", () => {
  const samples = Float32Array.from({ length: 100 }, (_, i) =>
      i < 50 ? 0.5 : -0.5,
    ),
    original = samples.slice();
  const loop = seamlessLoop(samples, 0, 100, 10);
  expect(loop).toHaveLength(90);
  expect(Math.abs(loop[0]! - loop.at(-1)!)).toBeLessThan(0.11);
  expect([...loop].every((v) => Math.abs(v) <= 0.5)).toBe(true);
  expect(samples).toEqual(original);
});
