import { useState, useSyncExternalStore } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useDriveRuntime } from "../../app/RuntimeContext";
import { selectReading } from "../../core/telemetry/store";
import { colors } from "../../ui/theme";
import { Instrument } from "../../ui/Instrument";
import { StatusPill } from "../../ui/StatusPill";
import { SoundControls } from "../../ui/SoundControls";
import { ProfileSheet } from "../sound/ProfileSheet";
import { SettingsSheet } from "../settings/SettingsSheet";

export function DashboardScreen() {
  const runtime = useDriveRuntime();
  const state = useSyncExternalStore(
    runtime.store.subscribe,
    runtime.store.getState,
  );
  const session = useSyncExternalStore(
    runtime.session.subscribe,
    runtime.session.getState,
  );
  const app = useSyncExternalStore(runtime.subscribe, runtime.getState);
  const [profileOpen, setProfileOpen] = useState(false),
    [settingsOpen, setSettingsOpen] = useState(false);
  const rawPedal =
    state.selectedPedal !== null
      ? (selectReading(state, state.selectedPedal)?.raw ?? null)
      : null;
  const calibration =
    state.selectedPedal !== null
      ? runtime.learning.saved.pedalCalibration[state.selectedPedal]
      : undefined;
  const pedal =
    rawPedal === null || rawPedal < 0 || rawPedal > 100
      ? null
      : calibration
        ? Math.max(
            0,
            Math.min(
              100,
              ((rawPedal - calibration.released) /
                (calibration.pressed - calibration.released)) *
                100,
            ),
          )
        : rawPedal;
  const coolant = selectReading(state, 2)?.raw ?? null;
  const warning =
    coolant !== null &&
    ((app.coolant.lowWarning !== null && coolant <= app.coolant.lowWarning) ||
      (app.coolant.highWarning !== null && coolant >= app.coolant.highWarning));
  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={s.page}
    >
      <StatusPill state={state} />
      <Instrument
        rpm={selectReading(state, 0)?.raw ?? null}
        speed={selectReading(state, 1)?.raw ?? null}
        coolant={coolant}
        pedal={pedal}
        torque={selectReading(state, 34)?.raw ?? null}
        ceiling={app.rpmCeiling}
        pedalCalibrated={Boolean(calibration)}
        coolantMin={app.coolant.minimum}
        coolantMax={app.coolant.maximum}
        coolantWarning={warning}
      />
      {warning ? (
        <Text accessibilityRole="alert" style={s.message}>
          Configured coolant warning
        </Text>
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Sound profile, ${runtime.profile.name}`}
        style={s.profile}
        onPress={() => setProfileOpen(true)}
      >
        <Text style={s.profileIcon}>911</Text>
        <View style={s.profileCopy}>
          <Text style={s.small}>SOUND PROFILE</Text>
          <Text style={s.profileName}>{runtime.profile.name}</Text>
        </View>
        <Text style={s.chevron}>⌄</Text>
      </Pressable>
      <SoundControls />
      {state.connection !== "connected" ? (
        <Text accessibilityLiveRegion="polite" style={s.message}>
          {session.message}
        </Text>
      ) : null}
      <View style={s.footer}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Vehicle settings"
          onPress={() => setSettingsOpen(true)}
          style={s.footerButton}
        >
          <Text style={s.footerText}>Vehicle settings</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Disconnect BRZEE"
          onPress={() => {
            void runtime.disconnect();
          }}
          style={s.footerButton}
        >
          <Text style={s.footerText}>Disconnect</Text>
        </Pressable>
      </View>
      <ProfileSheet
        visible={profileOpen}
        onClose={() => setProfileOpen(false)}
      />
      {settingsOpen ? (
        <SettingsSheet visible onClose={() => setSettingsOpen(false)} />
      ) : null}
    </ScrollView>
  );
}
const s = StyleSheet.create({
  page: {
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 16,
    gap: 18,
  },
  profile: {
    alignSelf: "stretch",
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    paddingVertical: 17,
    paddingHorizontal: 20,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.rim,
  },
  profileIcon: {
    color: colors.accent,
    fontSize: 23,
    fontWeight: "500",
    fontStyle: "italic",
  },
  profileCopy: { flex: 1, gap: 5 },
  small: { color: colors.secondary, fontSize: 8, letterSpacing: 1.6 },
  profileName: { color: colors.text, fontSize: 16, fontWeight: "500" },
  chevron: { color: colors.secondary, fontSize: 22 },
  footer: {
    alignSelf: "stretch",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  footerButton: {
    minHeight: 44,
    paddingHorizontal: 12,
    justifyContent: "center",
  },
  footerText: { color: colors.secondary, fontSize: 12 },
  message: {
    color: colors.secondary,
    fontSize: 13,
    textAlign: "center",
    lineHeight: 20,
  },
});
