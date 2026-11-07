import { StyleSheet, Text, View, useWindowDimensions } from "react-native";
import Svg, {
  Circle,
  Defs,
  RadialGradient,
  Stop,
  Line,
} from "react-native-svg";
import { SegmentBar } from "./SegmentBar";
import { colors } from "./theme";
export interface InstrumentProps {
  rpm: number | null;
  speed: number | null;
  coolant: number | null;
  pedal: number | null;
  torque: number | null;
  ceiling: number;
  pedalCalibrated: boolean;
  coolantMin?: number;
  coolantMax?: number;
  coolantWarning?: boolean;
}
export function Instrument({
  rpm,
  speed,
  coolant,
  pedal,
  torque,
  ceiling,
  pedalCalibrated,
  coolantMin = -40,
  coolantMax = 150,
  coolantWarning = false,
}: InstrumentProps) {
  const { width, fontScale } = useWindowDimensions(),
    size = Math.min(width - 32, 390);
  if (fontScale > 1.4)
    return (
      <View style={s.large}>
        {[
          ["Speed", speed, "km/h"],
          ["Engine", rpm, "rpm"],
          ["Coolant", coolant, "°C"],
          [pedalCalibrated ? "Pedal travel" : "Pedal sensor", pedal, "%"],
          ["Estimated torque", torque, "Nm"],
        ].map(([label, value, unit]) => (
          <View key={String(label)} style={s.largeRow}>
            <Text style={s.largeLabel}>{label}</Text>
            <Text
              accessibilityLabel={
                value === null
                  ? `${label} unavailable`
                  : `${label} ${value} ${unit}`
              }
              style={s.largeValue}
            >
              {value ?? "—"} <Text style={s.unit}>{unit}</Text>
            </Text>
          </View>
        ))}
      </View>
    );
  return (
    <View style={{ width: size, height: (size * 410) / 360 }}>
      <Svg
        width="100%"
        height="100%"
        viewBox="0 0 360 410"
        accessible={false}
        importantForAccessibility="no-hide-descendants"
      >
        <Defs>
          <RadialGradient id="face" cx="50%" cy="43%" r="65%">
            <Stop offset="0" stopColor="#1c1e21" />
            <Stop offset="1" stopColor={colors.background} />
          </RadialGradient>
        </Defs>
        <Circle
          cx={180}
          cy={230}
          r={149}
          fill="url(#face)"
          stroke={colors.rim}
          strokeWidth={1.2}
        />
        <Circle
          cx={180}
          cy={230}
          r={143}
          fill="none"
          stroke="#24272a"
          strokeWidth={0.6}
        />
        <SegmentBar
          value={rpm === null ? null : rpm / ceiling}
          count={20}
          x={43}
          y={26}
          arc
        />
        <SegmentBar
          value={
            coolant === null
              ? null
              : (coolant - coolantMin) / (coolantMax - coolantMin)
          }
          x={29}
          y={160}
          vertical
          color={coolantWarning ? colors.danger : colors.text}
        />
        <SegmentBar
          value={pedal === null ? null : pedal / 100}
          x={315}
          y={160}
          vertical
        />
        <Line x1={139} x2={221} y1={311} y2={311} stroke={colors.rim} />
      </Svg>
      <View style={s.rpm}>
        <Text
          accessibilityLabel={rpm === null ? "RPM unavailable" : `${rpm} rpm`}
          style={s.rpmValue}
        >
          {rpm?.toLocaleString() ?? "—"} <Text style={s.rpmUnit}>rpm</Text>
        </Text>
      </View>
      <View style={s.speed}>
        <Text
          accessibilityLabel={
            speed === null
              ? "Speed unavailable"
              : `${speed} kilometers per hour`
          }
          style={s.speedValue}
          adjustsFontSizeToFit
          minimumFontScale={0.6}
          numberOfLines={1}
        >
          {speed ?? "—"}
        </Text>
        <Text style={s.speedUnit}>km/h</Text>
      </View>
      <View style={s.coolant}>
        <Text style={s.smallLabel}>COOLANT</Text>
        <Text
          accessibilityLabel={
            coolant === null
              ? "Coolant unavailable"
              : `Coolant ${coolant} degrees Celsius`
          }
          style={[s.sideValue, coolantWarning ? s.warning : null]}
        >
          {coolant ?? "—"}
          <Text style={s.sideUnit}>°C</Text>
        </Text>
      </View>
      <View style={s.pedal}>
        <Text style={s.smallLabel}>PEDAL</Text>
        <Text
          accessibilityLabel={
            pedal === null
              ? "Pedal unavailable"
              : `Pedal ${Math.round(pedal)} percent ${pedalCalibrated ? "travel" : "raw sensor"}`
          }
          style={s.sideValue}
        >
          {pedal === null ? "—" : Math.round(pedal)}
          <Text style={s.sideUnit}>%</Text>
        </Text>
        <Text style={s.micro}>{pedalCalibrated ? "TRAVEL" : "SENSOR"}</Text>
      </View>
      <View style={s.torque}>
        <View style={s.torqueRow}>
          <Text style={s.torqueValue}>{torque ?? "—"}</Text>
          <Text style={s.unit}>Nm</Text>
        </View>
        <Text style={s.smallLabel}>EST. TORQUE</Text>
      </View>
      <Text style={s.scale}>
        WORKING SCALE · {Math.round((ceiling / 1000) * 10) / 10}k rpm
      </Text>
    </View>
  );
}
const s = StyleSheet.create({
  rpm: {
    position: "absolute",
    top: "25%",
    left: 0,
    right: 0,
    alignItems: "center",
  },
  rpmValue: {
    color: colors.text,
    fontSize: 21,
    fontWeight: "500",
    fontVariant: ["tabular-nums"],
  },
  rpmUnit: { fontSize: 11, color: colors.secondary },
  speed: {
    position: "absolute",
    top: "42%",
    left: "29%",
    right: "29%",
    alignItems: "center",
  },
  speedValue: {
    color: colors.text,
    fontSize: 82,
    fontWeight: "300",
    fontVariant: ["tabular-nums"],
    letterSpacing: -4,
    lineHeight: 94,
  },
  speedUnit: { color: colors.secondary, fontSize: 12, letterSpacing: 2 },
  coolant: {
    position: "absolute",
    top: "48%",
    left: "14%",
    width: "20%",
    alignItems: "center",
    gap: 8,
  },
  pedal: {
    position: "absolute",
    top: "48%",
    right: "14%",
    width: "20%",
    alignItems: "center",
    gap: 7,
  },
  sideValue: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "500",
    fontVariant: ["tabular-nums"],
  },
  sideUnit: { fontSize: 10, color: colors.secondary },
  smallLabel: { color: colors.secondary, fontSize: 8, letterSpacing: 1.1 },
  micro: { color: colors.unavailable, fontSize: 7, letterSpacing: 0.8 },
  torque: {
    position: "absolute",
    top: "79%",
    left: 0,
    right: 0,
    alignItems: "center",
    gap: 8,
  },
  torqueRow: { flexDirection: "row", gap: 5, alignItems: "baseline" },
  torqueValue: {
    color: colors.text,
    fontSize: 23,
    fontWeight: "400",
    fontVariant: ["tabular-nums"],
  },
  unit: { color: colors.secondary, fontSize: 12 },
  scale: {
    position: "absolute",
    bottom: 1,
    alignSelf: "center",
    color: colors.unavailable,
    fontSize: 8,
    letterSpacing: 1.2,
  },
  warning: { color: colors.danger },
  large: { alignSelf: "stretch", gap: 20, padding: 8 },
  largeRow: {
    gap: 6,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.rim,
  },
  largeLabel: { color: colors.secondary, fontSize: 15 },
  largeValue: {
    color: colors.text,
    fontSize: 32,
    fontVariant: ["tabular-nums"],
  },
});
