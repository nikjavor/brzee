import { Clock, Snapshot } from "../core/protocol/types";
import { TelemetryStore, selectReading } from "../core/telemetry/store";
import { effectiveAge, sampleUptime } from "../core/telemetry/freshness";
import { BleSession } from "../core/session/BleSession";
import { BleTransport } from "../platform/ble/types";
import { AudioControl, createControl } from "../core/audio/control";
import { SoundProfile } from "../core/audio/types";
import { SoundSession, RecoveryGate } from "../core/audio/lifecycle";
import { LearningState } from "../core/vehicle/types";
import {
  initialLearning,
  updateLearning,
  capturePedal,
  LearningObservation,
} from "../core/vehicle/learning";
import { VehicleRepository } from "../core/vehicle/storage";
import {
  PreferencesRepository,
  defaultPreferences,
  CoolantSettings,
  validCoolant,
} from "../core/vehicle/preferences";
export interface AudioBackend {
  prepare(profile: SoundProfile): Promise<void>;
  suspend(): Promise<void>;
  apply(control: AudioControl, now: number): void;
  release(): Promise<void>;
}
export interface RuntimeState {
  enabled: boolean;
  loading: boolean;
  volume: number;
  mode: AudioControl["mode"];
  reason: AudioControl["reason"];
  error: string | null;
  rpmCeiling: number;
  idleRpm: number | null;
  hydrated: boolean;
  idleCapturing: boolean;
  pedalCapturing: boolean;
  calibrationMessage: string | null;
  coolant: CoolantSettings;
}
export class DriveRuntime {
  private connectionGeneration = 0;
  readonly store = new TelemetryStore();
  readonly session: BleSession;
  readonly sound = new SoundSession();
  learning: LearningState = initialLearning();
  private learningEpoch = 0;
  private recovery = new RecoveryGate();
  private lastFrame: Snapshot | null = null;
  private ready = false;
  private listeners = new Set<() => void>();
  private state: RuntimeState = {
    enabled: false,
    loading: false,
    volume: 0.5,
    mode: "muted",
    reason: "user",
    error: null,
    rpmCeiling: 5000,
    idleRpm: null,
    hydrated: false,
    idleCapturing: false,
    pedalCapturing: false,
    calibrationMessage: null,
    coolant: defaultPreferences().coolant,
  };
  constructor(
    transport: BleTransport,
    readonly backend: AudioBackend,
    readonly clock: Clock,
    readonly profile: SoundProfile,
    readonly repository?: VehicleRepository,
    readonly preferences?: PreferencesRepository,
  ) {
    this.session = new BleSession(transport, this.store, clock);
    this.store.subscribe(() => this.sync());
    if (!repository) this.state = { ...this.state, hydrated: true };
  }
  getState = () => this.state;
  reportError(message: string): void {
    this.update({ error: message });
  }
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private update(update: Partial<RuntimeState>) {
    const next = { ...this.state, ...update };
    if (
      (Object.keys(next) as (keyof RuntimeState)[]).every(
        (key) => next[key] === this.state[key],
      )
    )
      return;
    this.state = next;
    for (const listener of this.listeners) listener();
  }
  async initialize(): Promise<void> {
    const epoch = this.learningEpoch;
    try {
      const [saved, preferences] = await Promise.all([
        this.repository?.load(),
        this.preferences?.load(),
      ]);
      if (saved && epoch === this.learningEpoch)
        this.learning = initialLearning(saved);
      if (preferences) {
        this.sound.intent = {
          ...this.sound.intent,
          volume: preferences.volume,
        };
        this.update({ coolant: preferences.coolant });
      }
    } catch (error) {
      this.update({ error: `Could not read saved vehicle: ${String(error)}` });
    }
    this.update({ hydrated: true });
    this.sync();
  }
  async enableSound(): Promise<void> {
    if (!this.sound.enable()) return;
    const generation = this.sound.intent.generation;
    this.update({ enabled: true, loading: true, error: null });
    try {
      await this.backend.prepare(this.profile);
      if (generation !== this.sound.intent.generation) return;
      this.ready = true;
      this.update({ loading: false });
      this.sync();
    } catch (error) {
      if (generation !== this.sound.intent.generation) return;
      this.sound.mute();
      this.update({
        loading: false,
        enabled: false,
        error: `Could not load sound: ${String(error)}`,
      });
      this.sync();
    }
  }
  muteSound(): void {
    this.sound.mute();
    this.update({ enabled: false, loading: false });
    this.sync();
  }
  async disconnect(): Promise<void> {
    this.connectionGeneration++;
    this.update({
      idleCapturing: false,
      pedalCapturing: false,
      calibrationMessage: null,
    });
    this.muteSound();
    this.ready = false;
    await this.session.cancel();
    await this.backend.release();
  }
  async scanForDevices() {
    const cleanup = this.disconnect(),
      generation = this.connectionGeneration;
    await cleanup;
    return generation === this.connectionGeneration ? this.session.scan() : [];
  }
  async connectDevice(id: string): Promise<void> {
    const cleanup = this.disconnect(),
      generation = this.connectionGeneration;
    await cleanup;
    if (generation === this.connectionGeneration) await this.session.connect(id);
  }
  async flushVehicle(): Promise<void> {
    try {
      await Promise.all([this.repository?.flush(), this.preferences?.flush()]);
    } catch (error) {
      this.update({ error: `Could not save settings: ${String(error)}` });
    }
  }
  async resetVehicle(): Promise<void> {
    this.muteSound();
    this.learningEpoch++;
    this.learning = initialLearning();
    this.update({
      idleCapturing: false,
      pedalCapturing: false,
      calibrationMessage: "Vehicle learning reset.",
    });
    this.sync();
    try {
      await this.repository?.flush(this.learning.saved);
    } catch (error) {
      this.update({ error: `Could not save reset: ${String(error)}` });
    }
  }
  startIdleCapture(): void {
    this.learning = { ...this.learning, idleEvidence: [] };
    this.update({
      idleCapturing: true,
      calibrationMessage: "Hold a stable idle while stationary for 3 seconds.",
    });
  }
  cancelCalibration(): void {
    this.learning = {
      ...this.learning,
      idleEvidence: [],
      pendingPedalCapture: null,
    };
    this.update({
      idleCapturing: false,
      pedalCapturing: false,
      calibrationMessage: null,
    });
  }
  async calibratePedal(action: "released" | "pressed"): Promise<void> {
    const result = capturePedal(this.learning, action, this.observation());
    this.learning = result.state;
    this.update({
      pedalCapturing: result.state.pendingPedalCapture !== null,
      calibrationMessage:
        result.error ??
        (result.complete
          ? "Pedal travel calibrated."
          : "Released position captured. Capture full travel next."),
    });
    if (result.complete) {
      try {
        await this.repository?.flush(this.learning.saved);
      } catch (error) {
        this.update({ error: `Could not save calibration: ${String(error)}` });
      }
    }
    this.sync();
  }
  private savePreferences(): void {
    this.preferences?.save({
      schemaVersion: 1,
      volume: this.sound.intent.volume,
      profileId: this.profile.id,
      coolant: this.state.coolant,
    });
  }
  setVolume(volume: number): void {
    if (!Number.isFinite(volume)) return;
    this.sound.intent = {
      ...this.sound.intent,
      volume: Math.max(0, Math.min(1, volume)),
    };
    this.update({ volume: this.sound.intent.volume });
    this.savePreferences();
    this.sync();
  }
  setCoolant(settings: CoolantSettings): boolean {
    if (!validCoolant(settings)) return false;
    this.update({ coolant: settings });
    this.savePreferences();
    return true;
  }
  routeRemoved(): void {
    this.sound.routeRemoved();
    this.update({ loading: false });
    this.sync();
  }
  interruption(type: "began" | "ended", resume: boolean): void {
    this.sound.interruption(type, resume);
    this.ready = false;
    if (type === "ended") this.recovery.requireRecovery();
    this.sync();
    if (type === "began") {
      const generation = this.sound.intent.generation;
      void this.backend.suspend().catch((error) => {
        if (generation !== this.sound.intent.generation) return;
        this.muteSound();
        this.update({ error: `Could not pause audio: ${String(error)}` });
      });
    } else if (this.sound.intent.enabled) {
      // prepare is serialized after suspension by the backend; intent tokens
      // and the fresh-input gate still decide whether the graph may be heard.
      void this.enableSound();
    }
  }
  foreground(): void {
    this.recovery.requireRecovery();
    this.sync();
  }
  tick(): void {
    this.store.tick(this.clock.nowMs());
    this.sync();
  }
  private observation(): LearningObservation {
    const state = this.store.getState(),
      now = this.clock.nowMs(),
      frame = state.snapshot;
    const rpm = selectReading(state, 0, now),
      speed = selectReading(state, 1, now);
    const pedal =
      state.selectedPedal !== null
        ? selectReading(state, state.selectedPedal, now)
        : null;
    return {
      nowMonoMs: now,
      rpm: rpm?.raw ?? null,
      rpmAgeMs:
        rpm && frame
          ? effectiveAge(rpm, frame.receivedMonoMs, now).ms
          : Infinity,
      sampledUptimeMs: frame ? sampleUptime(frame, 0) : 0,
      speed: speed?.raw ?? null,
      pedalId: state.selectedPedal,
      pedal: pedal?.raw ?? null,
      captureIdle: this.state.idleCapturing,
    };
  }
  private sync(): void {
    const state = this.store.getState(),
      now = this.clock.nowMs();
    this.recovery.noteControl(now);
    if (state.snapshot && state.snapshot !== this.lastFrame) {
      this.lastFrame = state.snapshot;
      this.recovery.noteSnapshot(state.snapshot, now);
      const previous = this.learning;
      this.learning = updateLearning(previous, this.observation());
      if (this.learning.saved !== previous.saved) {
        this.repository?.schedule(this.learning.saved);
        if (
          this.state.idleCapturing &&
          this.learning.saved.idleRpm !== null &&
          this.learning.idleEvidence.length === 0
        ) {
          this.update({
            idleCapturing: false,
            calibrationMessage: "Idle calibrated.",
          });
          void this.flushVehicle();
        }
      }
    }
    if (!state.snapshot) {
      this.lastFrame = null;
      this.recovery.requireRecovery();
    }
    let control = createControl(
      state,
      this.learning,
      this.profile,
      this.sound.intent,
      now,
    );
    if (
      control.mode !== "muted" &&
      (!this.ready || !this.recovery.noteControl(now))
    )
      control = {
        ...control,
        mode: "muted",
        reason: "recovering",
        layers: [],
        rpmOnlyLayers: [],
      };
    try {
      this.backend.apply(control, now);
    } catch (error) {
      this.sound.mute();
      this.update({ error: `Audio stopped: ${String(error)}` });
    }
    this.update({
      enabled: this.sound.intent.enabled,
      volume: this.sound.intent.volume,
      mode: control.mode,
      reason: control.reason,
      rpmCeiling: this.learning.saved.rpmCeiling,
      idleRpm: this.learning.saved.idleRpm,
    });
  }
}
