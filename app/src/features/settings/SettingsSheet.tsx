import { useState, useSyncExternalStore } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Sheet } from "../../ui/Sheet";
import { CalibrationSheet } from "./CalibrationSheet";
import { useDriveRuntime } from "../../app/RuntimeContext";
import { colors } from "../../ui/theme";
import { effectiveAge } from "../../core/telemetry/freshness";
export function SettingsSheet({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const runtime = useDriveRuntime(),
    app = useSyncExternalStore(runtime.subscribe, runtime.getState);
  const telemetry = useSyncExternalStore(
    runtime.store.subscribe,
    runtime.store.getState,
  );
  const frame = telemetry.snapshot,
    now = telemetry.nowMonoMs;
  const readingAge = (id: number) =>
    frame?.readings[id]?.valid
      ? effectiveAge(frame.readings[id]!, frame.receivedMonoMs, now)
      : null;
  const [minimum, setMinimum] = useState(String(app.coolant.minimum)),
    [maximum, setMaximum] = useState(String(app.coolant.maximum)),
    [low, setLow] = useState(
      app.coolant.lowWarning === null ? "" : String(app.coolant.lowWarning),
    ),
    [high, setHigh] = useState(
      app.coolant.highWarning === null ? "" : String(app.coolant.highWarning),
    ),
    [message, setMessage] = useState<string | null>(null);
  function save() {
    const good = runtime.setCoolant({
      minimum: minimum.trim() ? Number(minimum) : NaN,
      maximum: maximum.trim() ? Number(maximum) : NaN,
      lowWarning: low.trim() ? Number(low) : null,
      highWarning: high.trim() ? Number(high) : null,
    });
    setMessage(
      good
        ? "Coolant display saved."
        : "Enter increasing display bounds and warning values within that range.",
    );
    if (good) void runtime.flushVehicle();
  }
  return (
    <Sheet visible={visible} title="Vehicle settings" onClose={onClose}>
      <CalibrationSheet />
      <View style={s.section}>
        <Text style={s.title}>Coolant display</Text>
        <Text style={s.detail}>
          Set the gauge range for your car. Leave warnings blank for neutral
          indicators.
        </Text>
        {(
          [
            ["Display minimum °C", minimum, setMinimum],
            ["Display maximum °C", maximum, setMaximum],
            ["Low warning °C (optional)", low, setLow],
            ["High warning °C (optional)", high, setHigh],
          ] as const
        ).map(([label, value, onChangeText]) => (
          <View key={label} style={s.field}>
            <Text style={s.label}>{label}</Text>
            <TextInput
              accessibilityLabel={label}
              value={value}
              onChangeText={onChangeText}
              keyboardType="numbers-and-punctuation"
              placeholder="—"
              placeholderTextColor={colors.unavailable}
              style={s.input}
            />
          </View>
        ))}
        <Pressable accessibilityRole="button" style={s.button} onPress={save}>
          <Text style={s.buttonText}>Save coolant display</Text>
        </Pressable>
        {message ? (
          <Text accessibilityLiveRegion="polite" style={s.detail}>
            {message}
          </Text>
        ) : null}
      </View>
      {__DEV__ ? (
        <View style={s.section}>
          <Text style={s.title}>Development diagnostics</Text>
          <Text selectable style={s.detail}>
            {JSON.stringify(
              {
                ...runtime.session.probe.report(now),
                sequence: frame?.sequence ?? null,
                streamAgeMs: frame
                  ? Math.max(0, now - frame.receivedMonoMs)
                  : null,
                rpmAge: readingAge(0),
                pedalId: telemetry.selectedPedal,
                pedalAge:
                  telemetry.selectedPedal !== null
                    ? readingAge(telemetry.selectedPedal)
                    : null,
              },
              null,
              2,
            )}
          </Text>
        </View>
      ) : null}
    </Sheet>
  );
}
const s = StyleSheet.create({
  section: { gap: 14, marginTop: 20 },
  title: { color: colors.text, fontSize: 20, fontWeight: "600" },
  detail: { color: colors.secondary, fontSize: 13, lineHeight: 21 },
  label: { color: colors.text, fontSize: 14 },
  field: { gap: 8 },
  input: {
    color: colors.text,
    fontSize: 17,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.rim,
    borderRadius: 12,
    backgroundColor: colors.surface,
  },
  button: {
    padding: 16,
    borderRadius: 14,
    backgroundColor: colors.surface,
    minHeight: 48,
  },
  buttonText: { color: colors.accent, fontSize: 15, fontWeight: "600" },
});
