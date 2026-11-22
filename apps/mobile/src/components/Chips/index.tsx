import { Pressable, ScrollView, StyleSheet, View } from "react-native";

import { Txt } from "@/components/ui";
import { radius, space, useTheme } from "@/theme";

export type ChipOption<T extends string> = { value: T; label: string };

// A single-choice row of pills; scrolls sideways when it does not fit.
export const Chips = <T extends string>({
  options,
  value,
  onChange,
  scroll = false,
}: {
  options: ChipOption<T>[];
  value: T | null;
  onChange: (value: T) => void;
  scroll?: boolean;
}) => {
  const theme = useTheme();
  const items = options.map((option) => {
    const selected = option.value === value;

    return (
      <Pressable
        key={option.value}
        accessibilityRole="button"
        accessibilityState={{ selected }}
        onPress={() => onChange(option.value)}
        style={[
          styles.chip,
          {
            backgroundColor: selected ? theme.accent : theme.surface,
            borderColor: selected ? theme.accent : theme.line,
          },
        ]}
      >
        <Txt size={14} weight="600" style={{ color: selected ? theme.accentFg : theme.fg }}>
          {option.label}
        </Txt>
      </Pressable>
    );
  });

  return scroll ? (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {items}
    </ScrollView>
  ) : (
    <View style={[styles.row, { flexWrap: "wrap" }]}>{items}</View>
  );
};

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: space.sm },
  chip: {
    minHeight: 40,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth * 2,
    alignItems: "center",
    justifyContent: "center",
  },
});
