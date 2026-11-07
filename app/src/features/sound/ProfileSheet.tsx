import { Pressable, StyleSheet, Text, View } from "react-native";
import { useDriveRuntime } from "../../app/RuntimeContext";
import { Sheet } from "../../ui/Sheet";
import { colors } from "../../ui/theme";
export function ProfileSheet({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const runtime = useDriveRuntime();
  return (
    <Sheet visible={visible} title="Sound profile" onClose={onClose}>
      <Pressable
        accessibilityRole="radio"
        accessibilityState={{ checked: true }}
        onPress={onClose}
        style={s.profile}
      >
        <View style={s.badge}>
          <Text style={s.badgeText}>911</Text>
        </View>
        <View style={s.copy}>
          <Text style={s.name}>{runtime.profile.name}</Text>
          <Text style={s.detail}>Original sample pack · initial tuning</Text>
        </View>
        <Text style={s.selected}>✓</Text>
      </Pressable>
      <Text style={s.note}>
        Loop and pitch tuning is ready for listening review. Start with low
        volume and adjust to your drive.
      </Text>
    </Sheet>
  );
}
const s = StyleSheet.create({
  profile: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: 18,
    backgroundColor: colors.surface,
  },
  badge: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
  },
  badgeText: {
    color: colors.accent,
    fontSize: 18,
    fontWeight: "600",
    fontStyle: "italic",
  },
  copy: { flex: 1, gap: 6 },
  name: { color: colors.text, fontSize: 17, fontWeight: "600" },
  detail: { color: colors.secondary, fontSize: 12, lineHeight: 18 },
  selected: { color: colors.accent, fontSize: 22 },
  note: { color: colors.secondary, fontSize: 14, lineHeight: 23 },
});
