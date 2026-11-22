import { Ionicons } from "@expo/vector-icons";
import { addDays, type PlanDayResponse, type PlanItemResponse } from "@pt/contracts";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Pressable, View } from "react-native";

import { Button, Txt } from "@/components/ui";
import {
  currentWeekStart,
  dayTotals,
  equalShares,
  mealTotals,
  moveId,
  parseNumber,
  sharesTotal,
  shiftWeek,
  shortDate,
  today,
  weekDates,
  weekdayIndex,
  weekRange,
} from "@/lib/admin-utils";
import { confirmAction, useErrorText } from "@/lib/ui-helpers";
import { space, useTheme } from "@/theme";

import {
  addMeal,
  addMealItem,
  applyLastWeek,
  autoSolveMeal,
  copyMealPlanDay,
  createMealPlanDay,
  deleteMealPlanDay,
  fetchMealPlanCopyInfo,
  fetchMealPlanWeek,
  removeMeal,
  removeMealItem,
  renameMeal,
  reorderMeals,
  setMealShares,
  updateMealItemGrams,
} from "../api";
import { FoodPicker } from "../components/FoodPicker";
import { Banner, Card, Chip, ChipRow, Field, FormSheet, Loaded, Page, Pill } from "../components/kit";
import { ak } from "../keys";
import { useTraineeId } from "./TraineeDetailScreen";

type Meal = PlanDayResponse["meals"][number];

type Sheet =
  | { kind: "rename"; meal: Meal }
  | { kind: "grams"; item: PlanItemResponse }
  | { kind: "shares"; day: PlanDayResponse }
  | { kind: "copy"; day: PlanDayResponse }
  | { kind: "solve"; meal: Meal }
  | { kind: "food"; mealId: number }
  | null;

const IconBtn = ({
  name,
  label,
  onPress,
  color,
  disabled,
}: {
  name: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  color: string;
  disabled?: boolean;
}) => (
  <Pressable hitSlop={6} accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={onPress}>
    <Ionicons name={name} size={19} color={color} />
  </Pressable>
);

export const MealPlanScreen = () => {
  const { t } = useTranslation();
  const theme = useTheme();
  const queryClient = useQueryClient();
  const errorText = useErrorText();
  const userId = useTraineeId();
  const [week, setWeek] = useState(currentWeekStart);
  const range = weekRange(week);
  const query = useQuery({
    queryKey: ak.mealPlan(userId, week),
    queryFn: () => fetchMealPlanWeek(userId, week),
  });
  const [sheet, setSheet] = useState<Sheet>(null);
  const dates = useMemo(() => weekDates(week), [week]);
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ["admin", "trainee", userId, "meal-plan"] });

  // Runs one API call, refreshes the week and shows a failure as an alert.
  const run = async (action: () => Promise<unknown>, closeSheet = false) => {
    try {
      await action();
      if (closeSheet) {
        setSheet(null);
      }
      await refresh();
    } catch (error) {
      Alert.alert(errorText(error));
    }
  };

  return (
    <Page title={t("admin.trainee.mealPlan")} onRefresh={() => void query.refetch()} refreshing={query.isRefetching}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Pressable hitSlop={10} accessibilityRole="button" onPress={() => setWeek(shiftWeek(week, -1))}>
          <Ionicons name="chevron-back" size={22} color={theme.fg} />
        </Pressable>
        <Pressable accessibilityRole="button" onPress={() => setWeek(currentWeekStart())}>
          <Txt weight="600">
            {shortDate(range.from)} – {shortDate(range.to)}
          </Txt>
        </Pressable>
        <Pressable hitSlop={10} accessibilityRole="button" onPress={() => setWeek(shiftWeek(week, 1))}>
          <Ionicons name="chevron-forward" size={22} color={theme.fg} />
        </Pressable>
      </View>

      <Loaded query={query}>
        {(data) => (
          <>
            {data.lastWeekPlanCount > 0 ? (
              <Button
                variant="secondary"
                label={t("admin.mealPlan.applyLastWeek", { count: data.lastWeekPlanCount })}
                onPress={() =>
                  confirmAction({
                    title: t("admin.mealPlan.applyLastWeekTitle"),
                    message: t("admin.mealPlan.applyLastWeekBody"),
                    confirmLabel: t("admin.mealPlan.apply"),
                    cancelLabel: t("common.cancel"),
                    onConfirm: () => void run(() => applyLastWeek(userId, week)),
                  })
                }
              />
            ) : null}
            {dates.map((date) => {
              const day = data.days.find((d) => d.date === date);
              const completion = data.completion[date];

              return (
                <Card key={date} gap={space.sm}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
                    <Txt weight="700" style={{ flex: 1 }}>
                      {t(`admin.weekday.${weekdayIndex(date)}`)} · {shortDate(date)}
                      {day ? ` · ${Math.round(dayTotals(day).kcal)} kcal` : ""}
                    </Txt>
                    {completion && completion !== "none" ? (
                      <Pill
                        label={t(`admin.mealPlan.completion.${completion}`)}
                        tone={completion === "complete" ? "success" : "accent"}
                      />
                    ) : null}
                    {day ? (
                      <>
                        <IconBtn name="add-circle-outline" label={t("admin.mealPlan.addMeal")} color={theme.muted} onPress={() => void run(() => addMeal(day.id))} />
                        <IconBtn name="pie-chart-outline" label={t("admin.mealPlan.shares")} color={theme.muted} onPress={() => setSheet({ kind: "shares", day })} />
                        <IconBtn name="copy-outline" label={t("admin.mealPlan.copyDay")} color={theme.muted} onPress={() => setSheet({ kind: "copy", day })} />
                        <IconBtn
                          name="trash-outline"
                          label={t("admin.mealPlan.deleteDay")}
                          color={theme.danger}
                          onPress={() =>
                            confirmAction({
                              title: t("admin.mealPlan.deleteDay"),
                              message: t("admin.mealPlan.deleteDayBody"),
                              confirmLabel: t("common.delete"),
                              cancelLabel: t("common.cancel"),
                              destructive: true,
                              onConfirm: () => void run(() => deleteMealPlanDay(day.id)),
                            })
                          }
                        />
                      </>
                    ) : null}
                  </View>

                  {!day ? (
                    <Button
                      variant="secondary"
                      label={t("admin.mealPlan.createDay")}
                      onPress={() => void run(() => createMealPlanDay(userId, date))}
                    />
                  ) : (
                    day.meals.map((meal, index) => {
                      const totals = mealTotals(meal);

                      return (
                        <View key={meal.id} style={{ borderTopWidth: 1, borderTopColor: theme.line, paddingTop: space.sm, gap: 6 }}>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
                            <Pressable style={{ flex: 1 }} onPress={() => setSheet({ kind: "rename", meal })}>
                              <Txt weight="600">
                                {meal.name}
                                {meal.sharePercent !== null ? ` · ${meal.sharePercent}%` : ""}
                              </Txt>
                              <Txt size={12} tone="muted">
                                {t("admin.mealPlan.mealTotals", {
                                  kcal: Math.round(totals.kcal),
                                  protein: Math.round(totals.protein),
                                  carbs: Math.round(totals.carbs),
                                  fat: Math.round(totals.fat),
                                })}
                              </Txt>
                            </Pressable>
                            <IconBtn
                              name="arrow-up"
                              label={t("admin.workouts.moveUp")}
                              color={index === 0 ? theme.line : theme.muted}
                              disabled={index === 0}
                              onPress={() =>
                                void run(() =>
                                  reorderMeals(day.id, moveId(day.meals.map((m) => m.id), meal.id, "up")),
                                )
                              }
                            />
                            <IconBtn
                              name="arrow-down"
                              label={t("admin.workouts.moveDown")}
                              color={index === day.meals.length - 1 ? theme.line : theme.muted}
                              disabled={index === day.meals.length - 1}
                              onPress={() =>
                                void run(() =>
                                  reorderMeals(day.id, moveId(day.meals.map((m) => m.id), meal.id, "down")),
                                )
                              }
                            />
                            {meal.items.length > 0 ? (
                              <IconBtn name="flash-outline" label={t("admin.mealPlan.autoSolve")} color={theme.accent} onPress={() => setSheet({ kind: "solve", meal })} />
                            ) : null}
                            <IconBtn
                              name="close-circle-outline"
                              label={t("admin.mealPlan.removeMeal")}
                              color={theme.danger}
                              disabled={day.meals.length <= 1}
                              onPress={() =>
                                confirmAction({
                                  title: t("admin.mealPlan.removeMeal"),
                                  message: t("admin.mealPlan.removeMealBody"),
                                  confirmLabel: t("common.delete"),
                                  cancelLabel: t("common.cancel"),
                                  destructive: true,
                                  onConfirm: () => void run(() => removeMeal(meal.id)),
                                })
                              }
                            />
                          </View>
                          {meal.items.map((item) => (
                            <View key={item.id} style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
                              <Pressable style={{ flex: 1 }} onPress={() => setSheet({ kind: "grams", item })}>
                                <Txt size={14} numberOfLines={1}>
                                  {item.food.name}
                                  {item.food.isArchived ? ` (${t("admin.mealPlan.archived")})` : ""}
                                </Txt>
                                <Txt size={12} tone="muted">
                                  {item.grams} g · {Math.round((item.food.kcal * item.grams) / 100)} kcal
                                </Txt>
                              </Pressable>
                              <IconBtn
                                name="trash-outline"
                                label={t("common.delete")}
                                color={theme.danger}
                                onPress={() => void run(() => removeMealItem(item.id))}
                              />
                            </View>
                          ))}
                          <Pressable
                            accessibilityRole="button"
                            onPress={() => setSheet({ kind: "food", mealId: meal.id })}
                            style={{ minHeight: 36, justifyContent: "center" }}
                          >
                            <Txt tone="accent" weight="600" size={14}>
                              + {t("admin.mealPlan.addFood")}
                            </Txt>
                          </Pressable>
                        </View>
                      );
                    })
                  )}
                </Card>
              );
            })}
          </>
        )}
      </Loaded>

      <RenameSheet sheet={sheet} onClose={() => setSheet(null)} onSave={(meal, name) => run(() => renameMeal(meal.id, name), true)} />
      <GramsSheet sheet={sheet} onClose={() => setSheet(null)} onSave={(item, grams) => run(() => updateMealItemGrams(item.id, grams), true)} />
      <SharesSheet sheet={sheet} onClose={() => setSheet(null)} onSave={(day, shares) => run(() => setMealShares(day.id, shares), true)} />
      <SolveSheet sheet={sheet} onClose={() => setSheet(null)} onSave={(meal, fixed) => run(() => autoSolveMeal(meal.id, fixed), true)} />
      <CopySheet
        userId={userId}
        sheet={sheet}
        onClose={() => setSheet(null)}
        onSave={(day, dates) =>
          run(async () => {
            const result = await copyMealPlanDay(userId, day.id, dates);

            Alert.alert(t("admin.mealPlan.copied", { copied: result.copied, skipped: result.skipped }));
          }, true)
        }
      />
      <FoodPicker
        visible={sheet?.kind === "food"}
        onClose={() => setSheet(null)}
        onPick={(foodId) => {
          if (sheet?.kind === "food") {
            void run(() => addMealItem(sheet.mealId, foodId), true);
          }
        }}
      />
    </Page>
  );
};

const RenameSheet = ({
  sheet,
  onClose,
  onSave,
}: {
  sheet: Sheet;
  onClose: () => void;
  onSave: (meal: Meal, name: string) => Promise<void>;
}) => {
  const { t } = useTranslation();
  const meal = sheet?.kind === "rename" ? sheet.meal : null;
  const [name, setName] = useState("");
  const [seen, setSeen] = useState<number | null>(null);

  // Load the current name when the sheet opens for a meal.
  if (meal && seen !== meal.id) {
    setSeen(meal.id);
    setName(meal.name);
  }
  if (!meal && seen !== null) {
    setSeen(null);
  }
  return (
    <FormSheet visible={meal !== null} title={t("admin.mealPlan.rename")} onClose={onClose}>
      <Field label={t("admin.mealPlan.mealName")} value={name} onChangeText={setName} maxLength={40} />
      <Button label={t("common.save")} disabled={name.trim() === ""} onPress={() => meal && void onSave(meal, name)} />
    </FormSheet>
  );
};

const GramsSheet = ({
  sheet,
  onClose,
  onSave,
}: {
  sheet: Sheet;
  onClose: () => void;
  onSave: (item: PlanItemResponse, grams: number) => Promise<void>;
}) => {
  const { t } = useTranslation();
  const item = sheet?.kind === "grams" ? sheet.item : null;
  const [grams, setGrams] = useState("");
  const [seen, setSeen] = useState<number | null>(null);

  if (item && seen !== item.id) {
    setSeen(item.id);
    setGrams(String(item.grams));
  }
  if (!item && seen !== null) {
    setSeen(null);
  }
  const value = parseNumber(grams);

  return (
    <FormSheet visible={item !== null} title={item?.food.name ?? ""} onClose={onClose}>
      <Field label={t("admin.mealPlan.grams")} value={grams} onChangeText={setGrams} keyboardType="decimal-pad" />
      <Button
        label={t("common.save")}
        disabled={!Number.isFinite(value) || value <= 0}
        onPress={() => item && void onSave(item, value)}
      />
    </FormSheet>
  );
};

const SharesSheet = ({
  sheet,
  onClose,
  onSave,
}: {
  sheet: Sheet;
  onClose: () => void;
  onSave: (day: PlanDayResponse, shares: { mealId: number; percent: number }[] | null) => Promise<void>;
}) => {
  const { t } = useTranslation();
  const day = sheet?.kind === "shares" ? sheet.day : null;
  const [values, setValues] = useState<string[]>([]);
  const [seen, setSeen] = useState<number | null>(null);

  if (day && seen !== day.id) {
    setSeen(day.id);
    const equal = equalShares(day.meals.length);

    setValues(day.meals.map((meal, index) => String(meal.sharePercent ?? equal[index])));
  }
  if (!day && seen !== null) {
    setSeen(null);
  }
  const total = sharesTotal(values);
  const valid = Math.abs(total - 100) < 0.01 && values.every((v) => parseNumber(v) > 0);

  return (
    <FormSheet visible={day !== null} title={t("admin.mealPlan.shares")} onClose={onClose}>
      {day?.meals.map((meal, index) => (
        <Field
          key={meal.id}
          label={meal.name}
          value={values[index] ?? ""}
          onChangeText={(text) => setValues((current) => current.map((v, i) => (i === index ? text : v)))}
          keyboardType="decimal-pad"
        />
      ))}
      <Txt size={13} tone={valid ? "muted" : "danger"}>
        {t("admin.mealPlan.sharesTotal", { total: Math.round(total * 10) / 10 })}
      </Txt>
      <Button
        label={t("common.save")}
        disabled={!valid}
        onPress={() =>
          day &&
          void onSave(
            day,
            day.meals.map((meal, index) => ({ mealId: meal.id, percent: parseNumber(values[index]) })),
          )
        }
      />
      <Button label={t("admin.mealPlan.sharesEqual")} variant="secondary" onPress={() => day && void onSave(day, null)} />
    </FormSheet>
  );
};

const SolveSheet = ({
  sheet,
  onClose,
  onSave,
}: {
  sheet: Sheet;
  onClose: () => void;
  onSave: (meal: Meal, fixedItemIds: number[]) => Promise<void>;
}) => {
  const { t } = useTranslation();
  const meal = sheet?.kind === "solve" ? sheet.meal : null;
  const [fixed, setFixed] = useState<number[]>([]);
  const [seen, setSeen] = useState<number | null>(null);

  if (meal && seen !== meal.id) {
    setSeen(meal.id);
    setFixed([]);
  }
  if (!meal && seen !== null) {
    setSeen(null);
  }
  return (
    <FormSheet visible={meal !== null} title={t("admin.mealPlan.autoSolve")} onClose={onClose}>
      <Banner tone="info" text={t("admin.mealPlan.autoSolveHint")} />
      <ChipRow>
        {meal?.items.map((item) => (
          <Chip
            key={item.id}
            label={`${item.food.name} · ${item.grams} g`}
            selected={fixed.includes(item.id)}
            onPress={() =>
              setFixed((current) =>
                current.includes(item.id) ? current.filter((id) => id !== item.id) : [...current, item.id],
              )
            }
          />
        ))}
      </ChipRow>
      <Button label={t("admin.mealPlan.solve")} onPress={() => meal && void onSave(meal, fixed)} />
    </FormSheet>
  );
};

const CopySheet = ({
  userId,
  sheet,
  onClose,
  onSave,
}: {
  userId: number;
  sheet: Sheet;
  onClose: () => void;
  onSave: (day: PlanDayResponse, dates: string[]) => Promise<void>;
}) => {
  const { t } = useTranslation();
  const day = sheet?.kind === "copy" ? sheet.day : null;
  const start = today();
  const targets = useMemo(() => Array.from({ length: 21 }, (_, i) => addDays(start, i)), [start]);
  const [picked, setPicked] = useState<string[]>([]);
  const info = useQuery({
    queryKey: ak.mealCopyInfo(userId, start),
    queryFn: () => fetchMealPlanCopyInfo(userId, start, addDays(start, 41)),
    enabled: day !== null,
  });
  const logged = new Set(info.data?.logDates ?? []);
  const planned = new Set(info.data?.planDates ?? []);

  return (
    <FormSheet visible={day !== null} title={t("admin.mealPlan.copyDay")} onClose={onClose}>
      <Txt size={13} tone="muted">
        {t("admin.mealPlan.copyHint")}
      </Txt>
      <ChipRow>
        {targets
          .filter((target) => target !== day?.date && !logged.has(target))
          .map((target) => (
            <Chip
              key={target}
              label={`${t(`admin.weekday.${weekdayIndex(target)}`)} ${shortDate(target)}${planned.has(target) ? " •" : ""}`}
              selected={picked.includes(target)}
              onPress={() =>
                setPicked((current) =>
                  current.includes(target)
                    ? current.filter((d) => d !== target)
                    : current.length < 14
                      ? [...current, target]
                      : current,
                )
              }
            />
          ))}
      </ChipRow>
      <Button
        label={t("admin.workouts.copyTo", { count: picked.length })}
        disabled={picked.length === 0}
        onPress={() => day && void onSave(day, picked).then(() => setPicked([]))}
      />
    </FormSheet>
  );
};
