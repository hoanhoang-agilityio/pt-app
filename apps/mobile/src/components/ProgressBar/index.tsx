import { StyleSheet, View } from "react-native";

import { radius, useTheme } from "@/theme";

export const ProgressBar = ({
  percent,
  tone = "accent",
  height = 8,
  label,
}: {
  percent: number;
  tone?: "accent" | "success" | "danger";
  height?: number;
  label?: string;
}) => {
  const theme = useTheme();
  const value = Math.max(0, Math.min(100, Math.round(percent)));
  const color =
    tone === "success" ? theme.success : tone === "danger" ? theme.danger : theme.accent;

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: value }}
      style={[styles.track, { height, backgroundColor: theme.line }]}
    >
      <View style={{ width: `${value}%`, height, backgroundColor: color, borderRadius: radius.pill }} />
    </View>
  );
};

const styles = StyleSheet.create({
  track: { borderRadius: radius.pill, overflow: "hidden" },
});
