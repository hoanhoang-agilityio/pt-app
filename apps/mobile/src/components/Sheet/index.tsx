import type { ReactNode } from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Txt } from "@/components/ui";
import { radius, space, useTheme } from "@/theme";

// A bottom sheet: dimmed backdrop, rounded surface, closes on backdrop tap.
export const Sheet = ({
  visible,
  onClose,
  title,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}) => {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={[styles.backdrop, { backgroundColor: theme.overlay }]} onPress={onClose} />
      <View
        style={[
          styles.sheet,
          { backgroundColor: theme.surface, paddingBottom: insets.bottom + space.lg },
        ]}
      >
        <View style={[styles.grabber, { backgroundColor: theme.line }]} />
        {title ? (
          <Txt weight="600" size={17} style={{ marginBottom: space.md }}>
            {title}
          </Txt>
        ) : null}
        {children}
      </View>
    </Modal>
  );
};

// A tappable row of a sheet menu.
export const SheetAction = ({
  label,
  onPress,
  danger = false,
}: {
  label: string;
  onPress: () => void;
  danger?: boolean;
}) => (
  <Pressable
    accessibilityRole="button"
    onPress={onPress}
    style={({ pressed }) => [styles.action, pressed && { opacity: 0.6 }]}
  >
    <Txt tone={danger ? "danger" : "default"} size={16}>
      {label}
    </Txt>
  </Pressable>
);

const styles = StyleSheet.create({
  backdrop: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: "80%",
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
  },
  grabber: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    marginBottom: space.md,
  },
  action: { minHeight: 48, justifyContent: "center" },
});
