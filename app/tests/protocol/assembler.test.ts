import golden from "../fixtures/v1/golden.json";
import { Assembler } from "../../src/core/protocol/assembler";

const body = Uint8Array.from(Buffer.from(golden.bodyHex, "hex"));
function frames(seq: number, capacity = 239, input = body) {
  const count = Math.ceil(input.length / capacity);
  return Array.from({ length: count }, (_, i) =>
    Uint8Array.from([
      1,
      seq & 255,
      seq >>> 8,
      i,
      count,
      ...input.slice(i * capacity, (i + 1) * capacity),
    ]),
  );
}
test.each([239, 177, 15])(
  "publishes only a complete body at payload capacity %i",
  (capacity) => {
    const a = new Assembler(),
      parts = frames(4660, capacity);
    for (const part of parts.slice(0, -1)) expect(a.push(part, 10)).toBeNull();
    expect(a.push(parts.at(-1)!, 20)?.readings[2]).toEqual({
      raw: -40,
      valid: true,
      wireAgeMs: 50,
    });
    expect(a.push(parts[0]!, 21)).toBeNull();
  },
);
test("accepts sequence gaps and wrap, rejects old/duplicate and half-range sequences", () => {
  const a = new Assembler();
  for (const seq of [65534, 65535, 0, 7])
    expect(a.push(frames(seq)[0]!, 0)?.sequence).toBe(seq);
  for (const seq of [7, 6, 32775])
    expect(a.push(frames(seq)[0]!, 1)).toBeNull();
});
test("newer start supersedes partial; older starts do not disrupt newer partial", () => {
  const a = new Assembler();
  a.push(frames(10, 177)[0]!, 0);
  a.push(frames(12, 177)[0]!, 1);
  expect(a.push(frames(11, 177)[0]!, 2)).toBeNull();
  expect(a.push(frames(12, 177)[1]!, 3)?.sequence).toBe(12);
});
test("resets sequence on reconnect and after 1000ms without ANY notification", () => {
  const a = new Assembler();
  a.push(frames(100)[0]!, 0);
  a.push(new Uint8Array(), 900);
  expect(a.push(frames(0)[0]!, 1500)).toBeNull();
  expect(a.push(frames(0)[0]!, 2500)?.sequence).toBe(0);
  a.reset();
  expect(a.push(frames(0)[0]!, 2501)?.sequence).toBe(0);
  a.tick(3501);
  expect(a.push(frames(0)[0]!, 3502)?.sequence).toBe(0);
});
test.each(
  [
    [1, 0],
    [2, 1, 0, 0, 1, 0],
    [1, 1, 0, 0, 0, 0],
    [1, 1, 0, 0, 16, 0],
    [1, 1, 0, 1, 1, 0],
    [1, 1, 0, 0, 1],
    [1, 1, 0, 0, 1, ...new Array(240).fill(0)],
  ].map((bytes) => [bytes]),
)("rejects malformed header/payload and recovers %#", (bytes) => {
  const a = new Assembler();
  expect(a.push(Uint8Array.from(bytes), 0)).toBeNull();
  expect(a.push(frames(2)[0]!, 1)?.sequence).toBe(2);
});
test.each([
  "missing",
  "out-of-order",
  "count",
  "sequence",
  "unequal",
  "long-final",
  "short-body",
  "overlong-body",
  "reserved",
])("discards %s assembly and recovers", (kind) => {
  const a = new Assembler();
  let parts = frames(1, 15);
  if (kind === "short-body") parts = frames(1, 15, body.slice(0, 218));
  if (kind === "overlong-body")
    parts = frames(1, 15, Uint8Array.from([...body, 0]));
  if (kind === "reserved") {
    const b = body.slice();
    b[8] = 255;
    parts = frames(1, 15, b);
  }
  if (kind === "missing") parts.splice(1, 1);
  if (kind === "out-of-order") [parts[1], parts[2]] = [parts[2]!, parts[1]!];
  if (kind === "count") parts[1]![4] = 14;
  if (kind === "sequence") parts[1]![1] = 0;
  if (kind === "unequal") parts[1] = parts[1]!.slice(0, -1);
  if (kind === "long-final")
    parts[14] = Uint8Array.from([...parts[14]!, ...new Array(7).fill(0)]);
  for (const part of parts) expect(a.push(part, 0)).toBeNull();
  expect(a.push(frames(2)[0]!, 1)?.sequence).toBe(2);
});
