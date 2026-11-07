import golden from "../fixtures/v1/golden.json";
import { decodeBody } from "../../src/core/protocol/decode";
import { displayValue } from "../../src/core/protocol/signals";

const bytes = () => Uint8Array.from(Buffer.from(golden.bodyHex, "hex"));
test("decodes every fixed-order signed record, uint32 capture time, validity and uint16 age", () => {
  const result = decodeBody(bytes(), 4660, 123.5)!;
  expect(result).not.toBeNull();
  expect(result.sequence).toBe(4660);
  expect(result.capturedUptimeMs).toBe(4294967280);
  expect(result.receivedMonoMs).toBe(123.5);
  expect(result.readings.map((r) => r.raw)).toEqual(golden.rawValues);
  expect(result.readings.map((r) => r.wireAgeMs)).toEqual(golden.ages);
  expect(result.readings.map((r) => r.valid)).toEqual(
    Array.from({ length: 35 }, (_, id) => id !== 5),
  );
  expect(result.readings[5]).toEqual({ raw: 0, valid: false, wireAgeMs: 0 });
  expect(result.readings[34]).toEqual({
    raw: -86,
    valid: true,
    wireAgeMs: 65535,
  });
  expect(Object.isFrozen(result.readings)).toBe(true);
});
test.each([0, 218, 220])("rejects body length %i", (length) => {
  expect(decodeBody(new Uint8Array(length), 1, 0)).toBeNull();
});
test("rejects each reserved validity bit", () => {
  for (const bit of [8, 16, 32, 64, 128]) {
    const body = bytes();
    body[8] = body[8]! | bit;
    expect(decodeBody(body, 1, 0)).toBeNull();
  }
});
test.each([
  [7, 14500, 14.5],
  [14, 12345, 12.345],
  [15, 6789, 6.789],
  [22, -781, -7.81],
  [27, -123, -12.3],
  [33, 7210, 7.21],
  [34, -86, -86],
] as const)("converts display units for signal %i", (id, raw, want) =>
  expect(displayValue(id, raw)).toBe(want),
);
