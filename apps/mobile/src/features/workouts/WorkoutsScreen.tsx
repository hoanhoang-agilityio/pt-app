import { Ionicons } from "@expo/vector-icons";
import { type Href, useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  View,
} from "react-native";

import { ProgressBar } from "@/components/ProgressBar";
import { EmptyState, ErrorState, Screen, Skeleton, Txt } from "@/components/ui";
import { type DayMark, WeekStrip } from "@/components/WeekStrip";
import { useErrorText } from "@/lib/ui-helpers";
import { dayAfterWeekChange, shiftWeek, today, weekStartOf } from "@/lib/week";
import {
  getDayProgress,
  getWeekProgress,
  hasDayContent,
  isDayComplete,
} from "@/lib/workouts-model";
import { radius, space, useTheme } from "@/theme";

import { ExerciseCard } from "./components/ExerciseCard";
import { useWeekSchedule } from "./hooks";

// The trainee's week: day chips, week progress, the day's exercises with video,
// set logging and completion.
export const WorkoutsScreen = () => {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const errorText = useErrorText();
  const todayDate = today();
  const [weekStart, setWeekStart] = useState(() => weekStartOf(todayDate));
  const [selected, setSelected] = useState(todayDate);
  const schedule = useWeekSchedule(weekStart);
  const days = useMemo(() => schedule.data?.days ?? [], [schedule.data]);
  const day = days.find((entry) => entry.date === selected) ?? null;
  const marks = useMemo(() => {
    const result: Record<string, DayMark> = {};

    for (const entry of days) {
      const progress = getDayProgress(entry);

      result[entry.date] = isDayComplete(entry)
        ? "done"
        : progress.completed > 0
          ? "partial"
          : "none";
    }
    return result;
  }, [days]);
  const week = getWeekProgress(days);
  const shift = useCallback(
    (weeks: number) => {
      const next = shiftWeek(weekStart, weeks);

      setSelected((current) => dayAfterWeekChange(current, next, todayDate));
      setWeekStart(next);
    },
    [weekStart, todayDate],
  );

  const progress = day ? getDayProgress(day) : null;
  const hasExercises = (day?.exercises.length ?? 0) > 0;

  return (
    <Screen>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={{ padding: space.lg, gap: space.lg }}
          refreshControl={
            <RefreshControl
              refreshing={schedule.isRefetching && !schedule.isPending}
              onRefresh={() => void schedule.refetch()}
              tintColor={theme.accent}
            />
          }
        >
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Txt size={24} weight="700" style={{ flex: 1 }}>
              {t("workouts.title")}
            </Txt>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("train.summaryLink")}
              onPress={() => router.push("/summary" as string as Href)}
              hitSlop={8}
              style={{ padding: space.sm }}
            >
              <Ionicons name="stats-chart-outline" size={22} color={theme.accent} />
            </Pressable>
          </View>

          <WeekStrip
            weekStart={weekStart}
            selectedDate={selected}
            today={todayDate}
            onSelect={setSelected}
            onShift={shift}
            marks={marks}
          />

          {schedule.isPending ? (
            <View style={{ gap: space.md }}>
              <Skeleton height={10} />
              <Skeleton height={220} style={{ borderRadius: radius.lg }} />
              <Skeleton height={220} style={{ borderRadius: radius.lg }} />
            </View>
          ) : schedule.isError ? (
            <ErrorState message={errorText(schedule.error)} onRetry={() => void schedule.refetch()} />
          ) : (
            <>
              {week.total > 0 ? (
                <View style={{ gap: 6 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <Txt size={13} tone="muted" weight="600">
                      {t("train.weekProgressLabel")}
                    </Txt>
                    <Txt size={13} tone="muted">
                      {t("train.weekProgress", week)}
                    </Txt>
                  </View>
                  <ProgressBar percent={week.percent} label={t("train.weekProgressLabel")} />
                </View>
              ) : null}

              {day ? (
                <View style={{ gap: space.md }}>
                  <View style={{ gap: 2 }}>
                    <Txt tone="muted" size={13} weight="600">
                      {selected === todayDate ? t("train.today") : selected.split("-").reverse().join("/")}
                    </Txt>
                    <Txt size={20} weight="700">
                      {day.title || (hasExercises ? t("train.workoutTitle") : t("train.restTitle"))}
                    </Txt>
                    {day.note ? (
                      <Txt tone="muted" size={14}>
                        {day.note}
                      </Txt>
                    ) : null}
                  </View>
                  {progress && progress.completed > 0 ? (
                    <ProgressBar
                      percent={progress.percent}
                      tone="success"
                      label={t("train.dayProgress")}
                    />
                  ) : null}
                  {progress && progress.total > 0 && progress.percent === 100 ? (
                    <View style={{ backgroundColor: `${theme.success}1f`, borderRadius: radius.md, padding: space.md }}>
                      <Txt weight="600" style={{ color: theme.success }}>
                        {t("train.dayComplete")}
                      </Txt>
                    </View>
                  ) : null}
                  {hasExercises ? (
                    day.exercises.map((exercise, index) => (
                      <ExerciseCard
                        key={exercise.id}
                        exercise={exercise}
                        index={index}
                        isDue={day.date <= todayDate}
                      />
                    ))
                  ) : (
                    <View style={{ minHeight: 200 }}>
                      <EmptyState
                        icon="bed-outline"
                        title={hasDayContent(day) ? t("train.restTitle") : t("train.restDayTitle")}
                        hint={t("train.restDayDescription")}
                      />
                    </View>
                  )}
                </View>
              ) : null}
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
};
