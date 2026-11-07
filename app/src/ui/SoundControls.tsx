import { useSyncExternalStore } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Slider from "@react-native-community/slider";
import { useDriveRuntime } from "../app/RuntimeContext";
import { colors } from "./theme";
export function SoundControls() {
  const runtime = useDriveRuntime(),
    sound = useSyncExternalStore(runtime.subscribe, runtime.getState);
  const status = sound.loading
    ? "Preparing your sound…"
    : sound.reason === "route"
      ? "Output changed. Enable sound to continue."
      : sound.reason === "interruption"
        ? "Paused for an interruption"
        : sound.enabled
          ? sound.mode === "rpm-only"
            ? "RPM-only sound"
            : sound.mode === "muted"
              ? "Waiting for fresh RPM"
              : "Pedal-responsive sound"
          : "Sound muted";
  return (
    <View style={s.panel}>
      <View style={s.row}>
        <View style={s.copy}>
          <Text style={s.label}>ENGINE SOUND</Text>
          <Text style={s.status}>{status}</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={sound.enabled ? "Mute sound" : "Enable sound"}
          accessibilityState={{ selected: sound.enabled }}
          onPress={() => {
            if (sound.enabled) runtime.muteSound();
            else void runtime.enableSound();
          }}
          style={[s.toggle, sound.enabled ? s.enabled : null]}
        >
          <Text style={[s.toggleText, sound.enabled ? s.enabledText : null]}>
            {sound.enabled ? "Mute" : "Enable"}
          </Text>
        </Pressable>
      </View>
      <View style={s.row}>
        <Text style={s.volume}>VOL</Text>
        <Slider
          accessibilityRole="adjustable"
          accessibilityLabel="Engine volume"
          accessibilityValue={{
            min: 0,
            max: 100,
            now: Math.round(sound.volume * 100),
          }}
          accessibilityActions={[
            { name: "increment", label: "Increase volume" },
            { name: "decrement", label: "Decrease volume" },
          ]}
          onAccessibilityAction={(event) =>
            runtime.setVolume(
              sound.volume +
                (event.nativeEvent.actionName === "increment" ? 0.05 : -0.05),
            )
          }
          style={s.slider}
          minimumValue={0}
          maximumValue={1}
          value={sound.volume}
          onValueChange={(value) => runtime.setVolume(value)}
          minimumTrackTintColor={colors.accent}
          maximumTrackTintColor={colors.rim}
          thumbTintColor={colors.text}
        />
        <Text style={s.percent}>{Math.round(sound.volume * 100)}</Text>
      </View>
      {sound.error ? (
        <Text accessibilityRole="alert" style={s.error}>
          {sound.error}
        </Text>
      ) : null}
    </View>
  );
}
const s = StyleSheet.create({
  panel: {
    alignSelf: "stretch",
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 8,
    borderWidth: 1,
    borderColor: colors.rim,
    borderRadius: 20,
    gap: 8,
    backgroundColor: colors.surface,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  copy: { flex: 1, gap: 5 },
  label: { color: colors.secondary, fontSize: 8, letterSpacing: 1.6 },
  status: { color: colors.text, fontSize: 12, lineHeight: 18 },
  toggle: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.rim,
    paddingHorizontal: 20,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  enabled: { backgroundColor: colors.accent, borderColor: colors.accent },
  toggleText: { color: colors.text, fontSize: 12, fontWeight: "600" },
  enabledText: { color: colors.background },
  slider: { flex: 1, minHeight: 44 },
  volume: { color: colors.secondary, fontSize: 8, letterSpacing: 1 },
  percent: {
    color: colors.secondary,
    fontSize: 10,
    fontVariant: ["tabular-nums"],
    width: 23,
  },
  error: {
    color: colors.danger,
    fontSize: 12,
    lineHeight: 18,
    paddingBottom: 8,
  },
});
