import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, View } from "react-native";

import { Txt } from "@/components/ui";
import { currentLocale } from "@/i18n";
import { currentWeekStart, shiftWeek, shortDate, weekRange } from "@/lib/admin-utils";
import { formatAge } from "@/lib/time";
import { useTheme } from "@/theme";

import { fetchTraineeActivity, fetchTraineeProgress } from "../api";
import { Card, ListRow, Loaded, Page, Pill, SectionTitle } from "../components/kit";
import { ak } from "../keys";
import { useTraineeId } from "./TraineeDetailScreen";

const TREND_ICON = {
  first: "sparkles-outline",
  up: "trending-up-outline",
  same: "remove-outline",
  down: "trending-down-outline",
} as const;

// One trainee's weekly exercise progress (best sets) and recent activity.
export const ProgressScreen = () => {
  const { t } = useTranslation();
  const theme = useTheme();
  const userId = useTraineeId();
  const [week, setWeek] = useState(currentWeekStart);
  const progress = useQuery({
    queryKey: ak.traineeProgress(userId, week),
    queryFn: () => fetchTraineeProgress(userId, week),
  });
  const activity = useQuery({
    queryKey: ak.traineeActivity(userId),
    queryFn: () => fetchTraineeActivity(userId),
  });
  const labels = {
    now: t("time.now"),
    minutes: t("time.minutes"),
    hours: t("time.hours"),
    days: t("time.days"),
  };
  const now = new Date();

  return (
    <Page
      title={t("admin.trainee.progress")}
      refreshing={progress.isRefetching || activity.isRefetching}
      onRefresh={() => {
        void progress.refetch();
        void activity.refetch();
      }}
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Pressable hitSlop={10} accessibilityRole="button" onPress={() => setWeek(shiftWeek(week, -1))}>
          <Ionicons name="chevron-back" size={22} color={theme.fg} />
        </Pressable>
        <Pressable accessibilityRole="button" onPress={() => setWeek(currentWeekStart())}>
          <Txt weight="600">
            {shortDate(week)} – {shortDate(weekRange(week).to)}
          </Txt>
        </Pressable>
        <Pressable hitSlop={10} accessibilityRole="button" onPress={() => setWeek(shiftWeek(week, 1))}>
          <Ionicons name="chevron-forward" size={22} color={theme.fg} />
        </Pressable>
      </View>

      <Loaded query={progress}>
        {(data) =>
          data.rows.length === 0 ? (
            <Txt tone="muted">{t("admin.progress.empty")}</Txt>
          ) : (
            data.rows.map((row) => (
              <Card key={row.youtubeId}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Txt weight="600" style={{ flex: 1 }}>
                    {row.title}
                  </Txt>
                  <Ionicons name={TREND_ICON[row.trend]} size={20} color={row.trend === "down" ? theme.danger : theme.accent} />
                </View>
                <Txt size={14}>
                  {t("admin.progress.best", { kg: row.weekBest.weightKg, reps: row.weekBest.reps })}
                </Txt>
                <Txt size={13} tone="muted">
                  {row.previousBest
                    ? t("admin.progress.previous", {
                        kg: row.previousBest.weightKg,
                        reps: row.previousBest.reps,
                        change: row.changeKg === null ? "" : `${row.changeKg > 0 ? "+" : ""}${row.changeKg} kg`,
                      })
                    : t("admin.progress.first")}
                </Txt>
              </Card>
            ))
          )
        }
      </Loaded>

      <SectionTitle>{t("admin.dashboard.activityTitle")}</SectionTitle>
      <Loaded query={activity}>
        {(data) =>
          data.items.length === 0 ? (
            <Txt tone="muted">{t("admin.dashboard.activityEmpty")}</Txt>
          ) : (
            data.items.map((item) => (
              <ListRow
                key={`${item.kind}-${item.id}`}
                title={item.exerciseTitle}
                subtitle={
                  item.kind === "personalBest"
                    ? t("admin.progress.personalBest", { kg: item.best.weightKg, reps: item.best.reps })
                    : t("admin.progress.completed")
                }
                right={
                  <View style={{ alignItems: "flex-end", gap: 4 }}>
                    {item.kind === "personalBest" ? <Pill label="PR" tone="accent" /> : null}
                    <Txt size={12} tone="muted">
                      {formatAge(item.occurredAt, now, currentLocale(), labels)}
                    </Txt>
                  </View>
                }
              />
            ))
          )
        }
      </Loaded>
    </Page>
  );
};
