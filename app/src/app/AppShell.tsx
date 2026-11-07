import { useSyncExternalStore } from "react";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { DriveRuntime } from "./DriveRuntime";
import { RuntimeProvider } from "./RuntimeContext";
import { ConnectScreen } from "../features/connect/ConnectScreen";
import { DashboardScreen } from "../features/dashboard/DashboardScreen";
import { colors } from "../ui/theme";

// The same view is rendered by the device app and the isolated screenshot harness.
export function AppShell({ runtime }: { runtime: DriveRuntime }) {
  const state = useSyncExternalStore(
    runtime.store.subscribe,
    runtime.store.getState,
  );
  return (
    <RuntimeProvider runtime={runtime}>
      <SafeAreaProvider>
        <SafeAreaView style={styles.page}>
          <StatusBar style="light" />
          <View style={styles.header}>
            <Text maxFontSizeMultiplier={1.4} style={styles.brand}>
              BRZEE
            </Text>
            <Text maxFontSizeMultiplier={1.6} style={styles.label}>
              DRIVING, AMPLIFIED
            </Text>
          </View>
          {["waiting", "connected", "disconnected"].includes(
            state.connection,
          ) ? (
            <DashboardScreen />
          ) : (
            <ConnectScreen />
          )}
        </SafeAreaView>
      </SafeAreaProvider>
    </RuntimeProvider>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  header: {
    alignItems: "center",
    paddingTop: 22,
    paddingHorizontal: 24,
    gap: 8,
    backgroundColor: colors.background,
    zIndex: 1,
  },
  brand: {
    color: colors.text,
    fontSize: 25,
    letterSpacing: 7,
    fontWeight: "700",
  },
  label: {
    color: colors.secondary,
    fontSize: 9,
    letterSpacing: 2,
    textAlign: "center",
  },
});
