import { StyleSheet, Text, View } from "react-native";
import { TelemetryState } from "../core/telemetry/store";
import { STREAM_TIMEOUT_MS } from "../core/telemetry/freshness";
import { colors } from "./theme";
export function StatusPill({ state }: { state: TelemetryState }) {
  const fresh =
    state.connection === "connected" &&
    state.snapshot !== null &&
    state.nowMonoMs - state.snapshot.receivedMonoMs < STREAM_TIMEOUT_MS;
  const label = fresh
    ? "LIVE"
    : state.connection === "disconnected"
      ? "RECONNECTING"
      : state.snapshot
        ? "STALE"
        : "WAITING";
  return (
    <View accessibilityLiveRegion="polite" style={s.row}>
      <View
        style={[
          s.dot,
          { backgroundColor: fresh ? colors.accent : colors.unavailable },
        ]}
      />
      <Text style={s.label}>{label}</Text>
      <Text style={s.detail}>
        {fresh
          ? "BRZEE connected"
          : state.snapshot
            ? "Waiting for fresh data"
            : "Waiting for telemetry"}
      </Text>
    </View>
  );
}
const s = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    minHeight: 28,
  },
  dot: { width: 5, height: 5, borderRadius: 3 },
  label: {
    color: colors.text,
    fontSize: 9,
    fontWeight: "600",
    letterSpacing: 1.7,
  },
  detail: { color: colors.secondary, fontSize: 10 },
});
