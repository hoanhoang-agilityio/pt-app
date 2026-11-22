import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { KeyboardAvoidingView, Platform, Pressable, RefreshControl, ScrollView, View } from "react-native";

import { Card } from "@/components/Card";
import { ProgressBar } from "@/components/ProgressBar";
import { ErrorState, Screen, Skeleton, Txt } from "@/components/ui";
import { useErrorText } from "@/lib/ui-helpers";
import { formatWeekRange, shiftWeek, today, weekStartOf } from "@/lib/week";
import { getWeekProgress } from "@/lib/workouts-model";
import { radius, space, useTheme } from "@/theme";

import { useOverview } from "../nutrition/hooks";
import { useWeekSchedule } from "../workouts/hooks";
import { BodyProfileCard } from "./BodyProfileCard";
import { WeightCard } from "./WeightCard";

// The web "summary" page: the week's workout progress, nutrition numbers, the
// weight trend, the body profile and today's weigh-in.
export const SummaryScreen = () => {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const errorText = useErrorText();
  const todayDate = today();
  const [weekStart, setWeekStart] = useState(() => weekStartOf(todayDate));
  const schedule = useWeekSchedule(weekStart);
  const overview = useOverview(weekStart);
  const pending = schedule.isPending || overview.isPending;
  const failed = schedule.error ?? overview.error;
  const week = getWeekProgress(schedule.data?.days ?? []);
  const summary = overview.data?.summary;
  const refresh = () => {
    void schedule.refetch();
    void overview.refetch();
  };
  const goTabs = (path: "/workouts" | "/nutrition") => router.navigate(path);

  return (
    <Screen edges={["bottom"]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: space.lg, gap: space.lg }}
          refreshControl={
            <RefreshControl
              refreshing={(schedule.isRefetching || overview.isRefetching) && !pending}
              onRefresh={refresh}
              tintColor={theme.accent}
            />
          }
        >
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("train.weekPrev")}
              onPress={() => setWeekStart((current) => shiftWeek(current, -1))}
              style={{ width: 40, height: 40, alignItems: "center", justifyContent: "center" }}
            >
              <Ionicons name="chevron-back" size={22} color={theme.fg} />
            </Pressable>
            <Txt weight="600" style={{ flex: 1, textAlign: "center" }}>
              {formatWeekRange(weekStart)}
            </Txt>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("train.weekNext")}
              onPress={() => setWeekStart((current) => shiftWeek(current, 1))}
              style={{ width: 40, height: 40, alignItems: "center", justifyContent: "center" }}
            >
              <Ionicons name="chevron-forward" size={22} color={theme.fg} />
            </Pressable>
          </View>

          {pending ? (
            <View style={{ gap: space.md }}>
              <Skeleton height={110} style={{ borderRadius: radius.lg }} />
              <Skeleton height={110} style={{ borderRadius: radius.lg }} />
              <Skeleton height={220} style={{ borderRadius: radius.lg }} />
            </View>
          ) : failed || !overview.data ? (
            <ErrorState message={failed ? errorText(failed) : undefined} onRetry={refresh} />
          ) : (
            <>
              <Card>
                <Txt size={17} weight="700">
                  {t("train.summary.workouts")}
                </Txt>
                <Txt>{t("train.summary.sessions", week)}</Txt>
                <ProgressBar percent={week.percent} tone="success" label={t("train.weekProgressLabel")} />
                <Pressable accessibilityRole="button" onPress={() => goTabs("/workouts")}>
                  <Txt tone="accent" weight="600">
                    {t("train.summary.openWorkouts")}
                  </Txt>
                </Pressable>
              </Card>

              <Card>
                <Txt size={17} weight="700">
                  {t("train.summary.nutrition")}
                </Txt>
                {summary && summary.loggedDays > 0 ? (
                  <>
                    <Txt>{t("train.summary.loggedDays", { count: summary.loggedDays })}</Txt>
                    <Txt>{t("train.summary.onTargetDays", { count: summary.onTargetDays })}</Txt>
                    <Txt tone="muted" size={14}>
                      {t("train.summary.avgPerDay", { kcal: Math.round(summary.averageKcal) })}
                    </Txt>
                  </>
                ) : (
                  <Txt tone="muted" size={14}>
                    {t("train.summary.noNutrition")}
                  </Txt>
                )}
                <Pressable accessibilityRole="button" onPress={() => goTabs("/nutrition")}>
                  <Txt tone="accent" weight="600">
                    {t("train.summary.openNutrition")}
                  </Txt>
                </Pressable>
              </Card>

              <WeightCard key={`w-${overview.data.todayWeight}`} overview={overview.data} today={todayDate} />
              <BodyProfileCard
                key={`b-${overview.data.bodyProfile?.profile.weightKg ?? "none"}`}
                detail={overview.data.bodyProfile}
                isTargetManual={overview.data.latestTarget?.source === "manual"}
                today={todayDate}
              />
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
};
