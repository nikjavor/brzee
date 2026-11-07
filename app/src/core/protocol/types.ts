export type SignalId =
  | 0
  | 1
  | 2
  | 3
  | 4
  | 5
  | 6
  | 7
  | 8
  | 9
  | 10
  | 11
  | 12
  | 13
  | 14
  | 15
  | 16
  | 17
  | 18
  | 19
  | 20
  | 21
  | 22
  | 23
  | 24
  | 25
  | 26
  | 27
  | 28
  | 29
  | 30
  | 31
  | 32
  | 33
  | 34;
export type PedalId = 16 | 17 | 18 | 19;
export interface Reading {
  readonly raw: number;
  readonly valid: boolean;
  readonly wireAgeMs: number;
}
export interface Snapshot {
  readonly sequence: number;
  readonly capturedUptimeMs: number;
  readonly receivedMonoMs: number;
  readonly readings: readonly Reading[];
}
export interface Clock {
  nowMs(): number;
}
