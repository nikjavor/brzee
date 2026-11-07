import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { PropsWithChildren } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "./theme";
export function Sheet({
  visible,
  title,
  onClose,
  children,
}: PropsWithChildren<{
  visible: boolean;
  title: string;
  onClose: () => void;
}>) {
  return (
    <Modal
      visible={visible}
      presentationStyle="pageSheet"
      animationType="slide"
      onRequestClose={onClose}
    >
      <SafeAreaView style={s.page}>
        <View style={s.header}>
          <Text accessibilityRole="header" style={s.title}>
            {title}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Close ${title}`}
            onPress={onClose}
            style={s.close}
          >
            <Text style={s.closeText}>Done</Text>
          </Pressable>
        </View>
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={s.content}
        >
          {children}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  header: { padding: 20, flexDirection: "row", alignItems: "center", gap: 12 },
  title: { flex: 1, color: colors.text, fontSize: 23, fontWeight: "600" },
  close: { minHeight: 44, justifyContent: "center", paddingHorizontal: 8 },
  closeText: { color: colors.accent, fontSize: 16 },
  content: { paddingHorizontal: 24, paddingBottom: 36, gap: 20 },
});
