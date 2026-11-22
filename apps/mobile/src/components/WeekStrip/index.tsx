import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, View } from "react-native";

import { Txt } from "@/components/ui";
import { formatWeekRange, weekDatesOf } from "@/lib/week";
import { radius, space, useTheme } from "@/theme";

export type DayMark = "none" | "partial" | "done";

// Week header (previous / range / next) and the seven day chips shared by the
// workouts and nutrition tabs.
export const WeekStrip = ({
  weekStart,
  selectedDate,
  today,
  onSelect,
  onShift,
  marks = {},
}: {
  weekStart: string;
  selectedDate: string;
  today: string;
  onSelect: (date: string) => void;
  onShift: (weeks: number) => void;
  marks?: Record<string, DayMark>;
}) => {
  const { t } = useTranslation();
  const theme = useTheme();

  return (
    <View style={{ gap: space.md }}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("train.weekPrev")}
          hitSlop={8}
          onPress={() => onShift(-1)}
          style={styles.arrow}
        >
          <Ionicons name="chevron-back" size={22} color={theme.fg} />
        </Pressable>
        <Txt weight="600" style={{ flex: 1, textAlign: "center" }}>
          {formatWeekRange(weekStart)}
        </Txt>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("train.weekNext")}
          hitSlop={8}
          onPress={() => onShift(1)}
          style={styles.arrow}
        >
          <Ionicons name="chevron-forward" size={22} color={theme.fg} />
        </Pressable>
      </View>
      <View style={styles.row}>
        {weekDatesOf(weekStart).map((date, index) => {
          const selected = date === selectedDate;
          const mark = marks[date] ?? "none";

          return (
            <Pressable
              key={date}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={date}
              onPress={() => onSelect(date)}
              style={[
                styles.chip,
                {
                  backgroundColor: selected ? theme.accent : theme.surface,
                  borderColor: date === today ? theme.accent : theme.line,
                },
              ]}
            >
              <Txt size={12} weight="600" style={{ color: selected ? theme.accentFg : theme.muted }}>
                {t(`train.weekday.${index}`)}
              </Txt>
              <Txt size={16} weight="700" style={{ color: selected ? theme.accentFg : theme.fg }}>
                {Number(date.slice(8, 10))}
              </Txt>
              <View
                style={[
                  styles.dot,
                  {
                    backgroundColor:
                      mark === "done"
                        ? selected
                          ? theme.accentFg
                          : theme.success
                        : mark === "partial"
                          ? selected
                            ? theme.accentFg
                            : theme.accent
                          : "transparent",
                    opacity: mark === "partial" ? 0.6 : 1,
                  },
                ]}
              />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center" },
  arrow: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  row: { flexDirection: "row", gap: 6 },
  chip: {
    flex: 1,
    alignItems: "center",
    gap: 2,
    paddingVertical: space.sm,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
});
