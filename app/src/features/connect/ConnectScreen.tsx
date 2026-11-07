import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
} from "react-native";
import Svg, { Ellipse, G } from "react-native-svg";
import { useSyncExternalStore } from "react";
import { useDriveRuntime } from "../../app/RuntimeContext";
import { colors } from "../../ui/theme";

export function ConnectScreen() {
  const runtime = useDriveRuntime();
  const { width } = useWindowDimensions();
  const diameter = Math.min(width - 64, 300);
  const telemetry = useSyncExternalStore(
    runtime.store.subscribe,
    runtime.store.getState,
  );
  const session = useSyncExternalStore(
    runtime.session.subscribe,
    runtime.session.getState,
  );
  const app = useSyncExternalStore(runtime.subscribe, runtime.getState);
  const busy = ["scanning", "connecting"].includes(telemetry.connection);
  async function connect() {
    const devices = await runtime.scanForDevices();
    if (devices.length === 1) await runtime.connectDevice(devices[0]!.id);
  }
  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={s.page}
    >
      <Text style={s.eyebrow}>YOUR DRIVE. REIMAGINED.</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={busy ? "Cancel connection" : "Connect to BRZEE"}
        disabled={!app.hydrated}
        onPress={() => {
          void (busy ? runtime.disconnect() : connect());
        }}
        style={[
          s.circle,
          { width: diameter, height: diameter, borderRadius: diameter / 2 },
        ]}
      >
        <Svg width={90} height={100} viewBox="0 0 90 100" accessible={false}>
          <G rotation={-35} origin="45,50">
            <Ellipse
              cx={45}
              cy={33}
              rx={19}
              ry={30}
              fill="none"
              stroke={colors.accent}
              strokeWidth={2}
            />
            <Ellipse
              cx={45}
              cy={67}
              rx={19}
              ry={30}
              fill="none"
              stroke={colors.accent}
              strokeWidth={2}
            />
          </G>
        </Svg>
        <Text style={s.title}>{busy ? "Cancel" : "Connect"}</Text>
        <Text style={s.detail}>
          {busy ? "Finding your connection" : "BRZEE · Bluetooth LE"}
        </Text>
      </Pressable>
      <Text accessibilityLiveRegion="polite" style={s.message}>
        {session.error ?? session.message}
      </Text>
      {session.devices.length > 1
        ? session.devices.map((device) => (
            <Pressable
              accessibilityRole="button"
              key={device.id}
              style={s.device}
              onPress={() => {
                void runtime.connectDevice(device.id);
              }}
            >
              <Text style={s.deviceName}>{device.name}</Text>
              <Text style={s.detail}>
                {device.id} · {device.rssi ?? "—"} dBm
              </Text>
            </Pressable>
          ))
        : null}
      <Text style={s.foot}>
        Connect your BRZEE to bring your instruments to life.
      </Text>
    </ScrollView>
  );
}
const s = StyleSheet.create({
  page: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 28,
    padding: 24,
  },
  eyebrow: { color: colors.secondary, fontSize: 11, letterSpacing: 2 },
  circle: {
    width: 280,
    height: 280,
    borderRadius: 140,
    borderColor: colors.rim,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: colors.surface,
  },
  symbol: { color: colors.accent, fontSize: 70, fontWeight: "200" },
  title: { color: colors.text, fontSize: 28, fontWeight: "500" },
  detail: { color: colors.secondary, fontSize: 12 },
  message: { color: colors.text, fontSize: 14, textAlign: "center" },
  device: {
    padding: 16,
    borderWidth: 1,
    borderColor: colors.rim,
    borderRadius: 16,
    alignSelf: "stretch",
    gap: 5,
  },
  deviceName: { color: colors.text, fontWeight: "600" },
  foot: {
    color: colors.secondary,
    fontSize: 13,
    textAlign: "center",
    lineHeight: 21,
    maxWidth: 260,
  },
});
