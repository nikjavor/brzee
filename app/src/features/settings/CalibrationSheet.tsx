import { useSyncExternalStore } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useDriveRuntime } from "../../app/RuntimeContext";
import { colors } from "../../ui/theme";
import { signals } from "../../core/protocol/signals";
export function CalibrationSheet() {
  const runtime = useDriveRuntime();
  const app = useSyncExternalStore(runtime.subscribe, runtime.getState),
    telemetry = useSyncExternalStore(
      runtime.store.subscribe,
      runtime.store.getState,
    );
  return (
    <View style={s.section}>
      <Text style={s.title}>Vehicle learning</Text>
      <Text style={s.text}>
        Working RPM ceiling · {app.rpmCeiling.toLocaleString()} rpm
      </Text>
      <Text style={s.detail}>
        An adaptive display and sound scale. It is not a measured redline.
      </Text>
      <Text style={s.text}>
        Idle · {app.idleRpm ?? 800} rpm{" "}
        {app.idleRpm === null ? "(estimated)" : "(calibrated)"}
      </Text>
      <Pressable
        accessibilityRole="button"
        style={s.button}
        onPress={() => runtime.startIdleCapture()}
      >
        <Text style={s.buttonText}>
          {app.idleCapturing
            ? "Listening for stable idle…"
            : "Set idle from current car"}
        </Text>
      </Pressable>
      <Text style={s.title}>Pedal travel</Text>
      <Text style={s.text}>
        {telemetry.selectedPedal !== null
          ? signals[telemetry.selectedPedal][0]
          : "No pedal channel selected"}
      </Text>
      <Text style={s.detail}>
        Use ignition on with the engine off, while stationary. Capture the
        released position, then the fully pressed position. Until calibrated,
        the gauge shows raw sensor percent.
      </Text>
      <Pressable
        accessibilityRole="button"
        style={s.button}
        onPress={() => {
          void runtime.calibratePedal(
            app.pedalCapturing ? "pressed" : "released",
          );
        }}
      >
        <Text style={s.buttonText}>
          {app.pedalCapturing
            ? "Capture full pedal travel"
            : "Capture released pedal"}
        </Text>
      </Pressable>
      {app.idleCapturing || app.pedalCapturing ? (
        <Pressable
          accessibilityRole="button"
          style={s.button}
          onPress={() => runtime.cancelCalibration()}
        >
          <Text style={s.text}>Cancel capture</Text>
        </Pressable>
      ) : null}
      {app.calibrationMessage ? (
        <Text accessibilityLiveRegion="polite" style={s.text}>
          {app.calibrationMessage}
        </Text>
      ) : null}
      <Text style={s.detail}>
        Learning stays with BRZEE until you reset it. Reset after moving BRZEE to
        another car.
      </Text>
      <Pressable
        accessibilityRole="button"
        style={s.button}
        onPress={() => {
          void runtime.resetVehicle();
        }}
      >
        <Text style={s.reset}>Reset vehicle learning</Text>
      </Pressable>
    </View>
  );
}
const s = StyleSheet.create({
  section: { gap: 16 },
  title: { color: colors.text, fontSize: 20, fontWeight: "600", marginTop: 12 },
  text: { color: colors.text, fontSize: 15, lineHeight: 22 },
  detail: { color: colors.secondary, fontSize: 13, lineHeight: 21 },
  button: {
    padding: 16,
    borderRadius: 14,
    backgroundColor: colors.surface,
    minHeight: 48,
  },
  buttonText: { color: colors.accent, fontSize: 15, fontWeight: "600" },
  reset: { color: colors.danger, fontSize: 15 },
});
