export type LayerId =
  | "idle"
  | "on-low"
  | "on-mid"
  | "on-high"
  | "on-very-high"
  | "off-low"
  | "off-mid"
  | "off-high";
export interface SoundLayer {
  id: LayerId;
  file: string;
  group: "idle" | "on" | "off";
  sampleRate: number;
  frameCount: number;
  loopStartFrame: number;
  loopEndFrame: number;
  referenceRpm: number;
  gainDb: number;
  minimumRate: number;
  maximumRate: number;
}
export interface SoundProfile {
  schemaVersion: 1;
  id: string;
  name: string;
  idleRpm: number;
  maximumRpm: number;
  confidence: string;
  layers: SoundLayer[];
}
