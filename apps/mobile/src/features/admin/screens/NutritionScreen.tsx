import { KCAL_PER_GRAM, type NutritionOverviewResponse } from "@pt/contracts";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { type Href, useRouter } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Switch, View } from "react-native";

import { Button, Txt } from "@/components/ui";
import { currentWeekStart, roundTo, shortDate } from "@/lib/admin-utils";
import { space, useTheme } from "@/theme";

import { type BodyProfilePayload, fetchNutrition, saveBodyProfile, saveNutritionTarget } from "../api";
import { Banner, Card, Chip, ChipRow, Field, FormSheet, ListRow, Loaded, Page, SectionTitle, useFormError } from "../components/kit";
import { ak } from "../keys";
import { useTraineeId } from "./TraineeDetailScreen";

const ACTIVITY = ["sedentary", "light", "moderate", "active", "very_active"] as const;

const kcalOf = (carbs: number, protein: number, fat: number) =>
  Math.round(carbs * KCAL_PER_GRAM.carbs + protein * KCAL_PER_GRAM.protein + fat * KCAL_PER_GRAM.fat);

type Overview = NutritionOverviewResponse;

// A trainee's nutrition overview: target, body profile and the week's totals.
export const NutritionScreen = () => {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const userId = useTraineeId();
  const week = currentWeekStart();
  const query = useQuery({ queryKey: ak.nutrition(userId, week), queryFn: () => fetchNutrition(userId, week) });
  const [sheet, setSheet] = useState<"target" | "profile" | null>(null);
  const [busy, setBusy] = useState(false);
  const form = useFormError();
  const [target, setTarget] = useState({ carbs: "", protein: "", fat: "", note: "" });
  const [profile, setProfile] = useState<BodyProfilePayload>({
    sex: "male",
    age: "",
    heightCm: "",
    weightKg: "",
    activityLevel: "moderate",
    kcalAdjustment: "0",
    proteinPerKg: "1.6",
    applyToTarget: false,
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["admin", "trainee", userId, "nutrition"] });

  const openTarget = (data: Overview) => {
    const latest = data.latestTarget;

    form.clear();
    setTarget({
      carbs: latest ? String(latest.carbs) : "",
      protein: latest ? String(latest.protein) : "",
      fat: latest ? String(latest.fat) : "",
      note: latest?.note ?? "",
    });
    setSheet("target");
  };

  const openProfile = (data: Overview) => {
    const detail = data.bodyProfile;

    form.clear();
    if (detail) {
      setProfile({
        sex: detail.profile.sex,
        age: String(detail.energyPlan.age),
        heightCm: String(detail.profile.heightCm),
        weightKg: String(detail.profile.weightKg),
        activityLevel: detail.profile.activityLevel,
        kcalAdjustment: String(detail.profile.kcalAdjustment ?? 0),
        proteinPerKg: String(detail.profile.proteinPerKg ?? 1.6),
        applyToTarget: false,
      });
    }
    setSheet("profile");
  };

  const submit = async (run: () => Promise<unknown>) => {
    setBusy(true);
    form.clear();
    try {
      await run();
      setSheet(null);
      await refresh();
    } catch (error) {
      form.setError(error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Page title={t("admin.trainee.nutrition")} onRefresh={() => void query.refetch()} refreshing={query.isRefetching}>
      <Loaded query={query}>
        {(data) => (
          <>
            <SectionTitle>{t("admin.nutrition.target")}</SectionTitle>
            <Card gap={space.sm}>
              {data.latestTarget ? (
                <>
                  <Txt size={22} weight="700">
                    {kcalOf(data.latestTarget.carbs, data.latestTarget.protein, data.latestTarget.fat)} kcal
                  </Txt>
                  <Txt size={14}>
                    {t("admin.nutrition.macros", {
                      protein: data.latestTarget.protein,
                      carbs: data.latestTarget.carbs,
                      fat: data.latestTarget.fat,
                    })}
                  </Txt>
                  <Txt size={12} tone="muted">
                    {t("admin.nutrition.from", { date: shortDate(data.latestTarget.effectiveFrom) })}
                    {data.latestTarget.source === "tdee" ? ` · ${t("admin.nutrition.fromTdee")}` : ""}
                  </Txt>
                  {data.latestTarget.note ? <Txt size={13}>{data.latestTarget.note}</Txt> : null}
                </>
              ) : (
                <Txt tone="muted">{t("admin.nutrition.noTarget")}</Txt>
              )}
              <Button variant="secondary" label={t("admin.nutrition.editTarget")} onPress={() => openTarget(data)} />
            </Card>

            <SectionTitle>{t("admin.nutrition.body")}</SectionTitle>
            <Card gap={space.sm}>
              {data.bodyProfile ? (
                <>
                  <Txt size={14}>
                    {t("admin.nutrition.bodyLine", {
                      sex: t(`admin.nutrition.sex.${data.bodyProfile.profile.sex}`),
                      age: data.bodyProfile.energyPlan.age,
                      height: data.bodyProfile.profile.heightCm,
                      weight: data.bodyProfile.profile.weightKg,
                    })}
                  </Txt>
                  <Txt size={13} tone="muted">
                    {t(`admin.nutrition.activity.${data.bodyProfile.profile.activityLevel}`)}
                  </Txt>
                  <Txt size={13}>
                    {t("admin.nutrition.energy", {
                      bmr: Math.round(data.bodyProfile.energyPlan.bmr),
                      tdee: Math.round(data.bodyProfile.energyPlan.tdee),
                      target: Math.round(data.bodyProfile.energyPlan.targetCalories),
                    })}
                  </Txt>
                </>
              ) : (
                <Txt tone="muted">{t("admin.nutrition.noBody")}</Txt>
              )}
              <Button variant="secondary" label={t("admin.nutrition.editBody")} onPress={() => openProfile(data)} />
            </Card>

            <SectionTitle>{t("admin.nutrition.week")}</SectionTitle>
            <Card gap={4}>
              <Txt size={14}>
                {t("admin.nutrition.weekSummary", {
                  days: data.summary.loggedDays,
                  kcal: Math.round(data.summary.averageKcal),
                  onTarget: data.summary.onTargetDays,
                })}
              </Txt>
              {data.weightChange.latest !== null ? (
                <Txt size={13} tone="muted">
                  {t("admin.nutrition.weight", {
                    kg: data.weightChange.latest,
                    change:
                      data.weightChange.weekChange === null
                        ? "–"
                        : `${data.weightChange.weekChange > 0 ? "+" : ""}${roundTo(data.weightChange.weekChange, 1)}`,
                  })}
                </Txt>
              ) : null}
            </Card>
            {data.days.map((day) => (
              <ListRow
                key={day.date}
                title={shortDate(day.date)}
                subtitle={
                  day.loggedCount === 0
                    ? t("admin.nutrition.noLogs")
                    : t("admin.nutrition.dayLine", {
                        kcal: Math.round(day.totalKcal),
                        protein: Math.round(day.totals.protein),
                        carbs: Math.round(day.totals.carbs),
                        fat: Math.round(day.totals.fat),
                      })
                }
              />
            ))}

            <Button
              label={t("admin.trainee.mealPlan")}
              onPress={() => router.push(`/admin/trainee/${userId}/meal-plan` as string as Href)}
            />

            <FormSheet visible={sheet === "target"} title={t("admin.nutrition.editTarget")} onClose={() => setSheet(null)}>
              <View style={{ flexDirection: "row", gap: space.md }}>
                {(["protein", "carbs", "fat"] as const).map((key) => (
                  <View key={key} style={{ flex: 1 }}>
                    <Field
                      label={t(`admin.nutrition.${key}`)}
                      value={target[key]}
                      onChangeText={(text) => setTarget((c) => ({ ...c, [key]: text.replace(/\D/g, "") }))}
                      keyboardType="number-pad"
                      error={form.fieldError(key)}
                    />
                  </View>
                ))}
              </View>
              <Txt size={13} tone="muted">
                {t("admin.nutrition.kcalPreview", {
                  kcal: kcalOf(Number(target.carbs) || 0, Number(target.protein) || 0, Number(target.fat) || 0),
                })}
              </Txt>
              <Field
                label={t("admin.nutrition.note")}
                value={target.note}
                onChangeText={(note) => setTarget((c) => ({ ...c, note }))}
                multiline
                maxLength={1000}
                error={form.fieldError("note")}
              />
              {form.message && !form.hasFields ? <Banner text={form.message} /> : null}
              <Button
                label={t("common.save")}
                loading={busy}
                onPress={() => void submit(() => saveNutritionTarget(userId, target))}
              />
            </FormSheet>

            <FormSheet visible={sheet === "profile"} title={t("admin.nutrition.editBody")} onClose={() => setSheet(null)}>
              <ChipRow>
                {(["male", "female"] as const).map((sex) => (
                  <Chip key={sex} label={t(`admin.nutrition.sex.${sex}`)} selected={profile.sex === sex} onPress={() => setProfile((c) => ({ ...c, sex }))} />
                ))}
              </ChipRow>
              <View style={{ flexDirection: "row", gap: space.md }}>
                <View style={{ flex: 1 }}>
                  <Field label={t("admin.nutrition.age")} value={profile.age} onChangeText={(age) => setProfile((c) => ({ ...c, age }))} keyboardType="number-pad" error={form.fieldError("age")} />
                </View>
                <View style={{ flex: 1 }}>
                  <Field label={t("admin.nutrition.height")} value={profile.heightCm} onChangeText={(heightCm) => setProfile((c) => ({ ...c, heightCm }))} keyboardType="decimal-pad" error={form.fieldError("heightCm")} />
                </View>
                <View style={{ flex: 1 }}>
                  <Field label={t("admin.nutrition.weightKg")} value={profile.weightKg} onChangeText={(weightKg) => setProfile((c) => ({ ...c, weightKg }))} keyboardType="decimal-pad" error={form.fieldError("weightKg")} />
                </View>
              </View>
              <Txt size={13} weight="600" tone="muted">
                {t("admin.nutrition.activityLabel")}
              </Txt>
              <ChipRow>
                {ACTIVITY.map((level) => (
                  <Chip key={level} label={t(`admin.nutrition.activity.${level}`)} selected={profile.activityLevel === level} onPress={() => setProfile((c) => ({ ...c, activityLevel: level }))} />
                ))}
              </ChipRow>
              <View style={{ flexDirection: "row", gap: space.md }}>
                <View style={{ flex: 1 }}>
                  <Field label={t("admin.nutrition.kcalAdjustment")} value={profile.kcalAdjustment} onChangeText={(kcalAdjustment) => setProfile((c) => ({ ...c, kcalAdjustment }))} keyboardType="numbers-and-punctuation" error={form.fieldError("kcalAdjustment")} />
                </View>
                <View style={{ flex: 1 }}>
                  <Field label={t("admin.nutrition.proteinPerKg")} value={profile.proteinPerKg} onChangeText={(proteinPerKg) => setProfile((c) => ({ ...c, proteinPerKg }))} keyboardType="decimal-pad" error={form.fieldError("proteinPerKg")} />
                </View>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: space.md }}>
                <Switch value={profile.applyToTarget} onValueChange={(applyToTarget) => setProfile((c) => ({ ...c, applyToTarget }))} trackColor={{ true: theme.accent }} />
                <Txt size={13} style={{ flex: 1 }}>
                  {t("admin.nutrition.applyToTarget")}
                </Txt>
              </View>
              {form.message && !form.hasFields ? <Banner text={form.message} /> : null}
              <Button label={t("common.save")} loading={busy} onPress={() => void submit(() => saveBodyProfile(userId, profile))} />
            </FormSheet>
          </>
        )}
      </Loaded>
    </Page>
  );
};
