import type { ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Txt } from "@/components/ui";
import { radius, space, useTheme } from "@/theme";

// A bottom sheet for forms: it scrolls and rises above the keyboard.
export const FormSheet = ({
  visible,
  onClose,
  title,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) => {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.fill}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <Pressable style={[styles.fill, { backgroundColor: theme.overlay }]} onPress={onClose} />
        <View
          style={[
            styles.sheet,
            { backgroundColor: theme.surface, paddingBottom: insets.bottom + space.md },
          ]}
        >
          <View style={[styles.grabber, { backgroundColor: theme.line }]} />
          <Txt weight="600" size={17} style={{ marginBottom: space.md }}>
            {title}
          </Txt>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ gap: space.md, paddingBottom: space.md }}
          >
            {children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  fill: { flex: 1 },
  sheet: {
    maxHeight: "85%",
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
  },
  grabber: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, marginBottom: space.md },
});
