import { Ionicons } from "@expo/vector-icons";
import { type Href, useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Pressable, RefreshControl, ScrollView, View } from "react-native";

import { Card } from "@/components/Card";
import { ErrorState, Screen, Skeleton, Txt } from "@/components/ui";
import { type DayMark, WeekStrip } from "@/components/WeekStrip";
import { currentLocale } from "@/i18n";
import {
  buildMealView,
  formatGrams,
  type Macros,
  splitDayTarget,
} from "@/lib/nutrition-model";
import { confirmAction, useErrorText } from "@/lib/ui-helpers";
import { dayAfterWeekChange, shiftWeek, today, weekStartOf } from "@/lib/week";
import { radius, space, useTheme } from "@/theme";

import { FoodEntrySheet } from "./components/FoodEntrySheet";
import { MacroProgress } from "./components/MacroProgress";
import { MealCard } from "./components/MealCard";
import { MealLogSheet } from "./components/MealLogSheet";
import { PreferencesCard } from "./components/PreferencesCard";
import { useDeleteFoodEntry, useMealPlanWeek, useOverview } from "./hooks";

type LogSheet = { mealId: number; editing: import("@pt/contracts").MealLogResponse | null };

// The trainee's nutrition week: daily targets, the PT's meal plan with what was
// eaten, the request to the PT, the older free-text log and the food library.
export const NutritionScreen = () => {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const errorText = useErrorText();
  const locale = currentLocale();
  const todayDate = today();
  const [weekStart, setWeekStart] = useState(() => weekStartOf(todayDate));
  const [selected, setSelected] = useState(todayDate);
  const overview = useOverview(weekStart);
  const plan = useMealPlanWeek(weekStart);
  const removeEntry = useDeleteFoodEntry();
  const [logSheet, setLogSheet] = useState<LogSheet | null>(null);
  const [entrySheet, setEntrySheet] = useState<
    { entry: import("@pt/contracts").FoodEntryResponse | null } | null
  >(null);

  const shift = useCallback(
    (weeks: number) => {
      const next = shiftWeek(weekStart, weeks);

      setSelected((current) => dayAfterWeekChange(current, next, todayDate));
      setWeekStart(next);
    },
    [weekStart, todayDate],
  );

  const marks = useMemo(() => {
    const result: Record<string, DayMark> = {};

    for (const [date, state] of Object.entries(plan.data?.completion ?? {})) {
      result[date] = state === "complete" ? "done" : state === "partial" ? "partial" : "none";
    }
    return result;
  }, [plan.data]);

  const day = overview.data?.days.find((entry) => entry.date === selected) ?? null;
  const planDay = plan.data?.days.find((entry) => entry.date === selected) ?? null;
  const loggable = selected <= todayDate;
  const target: Macros | null = day?.target
    ? { carbs: day.target.carbs, protein: day.target.protein, fat: day.target.fat }
    : null;
  const views = useMemo(
    () =>
      planDay && plan.data
        ? planDay.meals.map((meal) => buildMealView(meal, plan.data.logs, plan.data.marks))
        : [],
    [planDay, plan.data],
  );
  const mealTargets = useMemo(
    () => (target && planDay ? splitDayTarget(target, planDay.meals.map((meal) => meal.sharePercent)) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [day?.target, planDay],
  );

  const pending = overview.isPending || plan.isPending;
  const failed = overview.error ?? plan.error;
  const refreshing = (overview.isRefetching || plan.isRefetching) && !pending;
  const refresh = () => {
    void overview.refetch();
    void plan.refetch();
  };
  const completion = plan.data?.completion[selected];

  return (
    <Screen>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: space.lg, gap: space.lg }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={theme.accent} />}
      >
        <Txt size={24} weight="700">
          {t("nutri.title")}
        </Txt>
        <WeekStrip
          weekStart={weekStart}
          selectedDate={selected}
          today={todayDate}
          onSelect={setSelected}
          onShift={shift}
          marks={marks}
        />

        {pending ? (
          <View style={{ gap: space.md }}>
            <Skeleton height={180} style={{ borderRadius: radius.lg }} />
            <Skeleton height={240} style={{ borderRadius: radius.lg }} />
          </View>
        ) : failed ? (
          <ErrorState message={errorText(failed)} onRetry={refresh} />
        ) : (
          <>
            {day ? (
              <Card>
                <Txt size={18} weight="700">
                  {day.target ? t("nutri.dailyTargets") : t("nutri.title")}
                </Txt>
                {day.target ? null : (
                  <Txt size={14} tone="muted">
                    {t("nutri.noTarget")}
                  </Txt>
                )}
                {day.target || day.loggedCount > 0 ? (
                  <MacroProgress totals={day.totals} kcal={day.totalKcal} target={target} />
                ) : null}
                {day.target?.note ? (
                  <View style={{ backgroundColor: `${theme.accent}1a`, borderRadius: radius.md, padding: space.md }}>
                    <Txt size={14}>{day.target.note}</Txt>
                  </View>
                ) : null}
                {completion && completion !== "none" ? (
                  <Txt size={13} weight="600" style={{ color: theme.success }}>
                    {t(`nutri.completion.${completion}`)}
                  </Txt>
                ) : null}
              </Card>
            ) : null}

            <Txt size={18} weight="700">
              {t("nutri.plan.title")}
            </Txt>
            {views.length === 0 ? (
              <Card>
                <Txt tone="muted">{t("nutri.plan.empty")}</Txt>
              </Card>
            ) : (
              views.map((view, index) => (
                <MealCard
                  // A fresh card per day resets half-typed notes.
                  key={`${selected}-${view.id}`}
                  view={view}
                  index={index}
                  target={mealTargets?.[index] ?? null}
                  loggable={loggable}
                  onAdd={(mealId) => setLogSheet({ mealId, editing: null })}
                  onEdit={(mealId, log) => setLogSheet({ mealId, editing: log })}
                />
              ))
            )}

            {day && (day.entries.length > 0 || (loggable && views.length === 0)) ? (
              <Card>
                <Txt size={17} weight="700">
                  {t("nutri.entries.title")}
                </Txt>
                {day.entries.map((entry) => (
                  <View key={entry.id} style={{ gap: 2 }}>
                    <Txt weight="600">{t(`nutri.meals.${entry.meal}`)}</Txt>
                    {entry.description ? <Txt size={14}>{entry.description}</Txt> : null}
                    <Txt size={12} tone="muted">
                      {`C ${formatGrams(entry.carbs ?? 0, locale)} · P ${formatGrams(entry.protein ?? 0, locale)} · F ${formatGrams(entry.fat ?? 0, locale)} g`}
                    </Txt>
                    <View style={{ flexDirection: "row", gap: space.lg }}>
                      <Pressable accessibilityRole="button" hitSlop={8} onPress={() => setEntrySheet({ entry })}>
                        <Txt size={13} tone="accent" weight="600">
                          {t("common.edit")}
                        </Txt>
                      </Pressable>
                      <Pressable
                        accessibilityRole="button"
                        hitSlop={8}
                        onPress={() =>
                          confirmAction({
                            title: t("nutri.entries.deleteConfirm"),
                            confirmLabel: t("common.delete"),
                            cancelLabel: t("common.cancel"),
                            destructive: true,
                            onConfirm: () =>
                              removeEntry.mutate(entry.id, {
                                onError: (error) => Alert.alert(errorText(error)),
                              }),
                          })
                        }
                      >
                        <Txt size={13} tone="danger" weight="600">
                          {t("common.delete")}
                        </Txt>
                      </Pressable>
                    </View>
                  </View>
                ))}
                {loggable && views.length === 0 ? (
                  <Pressable accessibilityRole="button" onPress={() => setEntrySheet({ entry: null })}>
                    <Txt tone="accent" weight="600">
                      + {t("nutri.entries.add")}
                    </Txt>
                  </Pressable>
                ) : null}
              </Card>
            ) : null}

            {plan.data ? (
              <PreferencesCard
                key={`${plan.data.preferences.preferredMealCount}-${plan.data.preferences.foodNote}`}
                preferredMealCount={plan.data.preferences.preferredMealCount}
                foodNote={plan.data.preferences.foodNote}
              />
            ) : null}

            <Pressable
              accessibilityRole="button"
              onPress={() => router.push("/foods" as string as Href)}
              style={{ flexDirection: "row", alignItems: "center", gap: space.md, minHeight: 56 }}
            >
              <Ionicons name="restaurant-outline" size={22} color={theme.accent} />
              <View style={{ flex: 1 }}>
                <Txt weight="600">{t("nutri.library.link")}</Txt>
                <Txt size={13} tone="muted">
                  {t("nutri.library.linkHint")}
                </Txt>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.muted} />
            </Pressable>
          </>
        )}
      </ScrollView>

      {logSheet ? (
        <MealLogSheet
          mealId={logSheet.mealId}
          editing={logSheet.editing}
          onClose={() => setLogSheet(null)}
          onDone={() => setLogSheet(null)}
        />
      ) : null}
      {entrySheet ? (
        <FoodEntrySheet date={selected} entry={entrySheet.entry} onClose={() => setEntrySheet(null)} />
      ) : null}
    </Screen>
  );
};
