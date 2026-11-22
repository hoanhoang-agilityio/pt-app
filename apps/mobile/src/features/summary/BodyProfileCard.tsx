import type { NutritionOverviewResponse } from "@pt/contracts";
import { BODY_LIMITS, parseDecimal } from "@pt/contracts";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, View } from "react-native";

import { Card } from "@/components/Card";
import { Chips } from "@/components/Chips";
import { Field } from "@/components/Field";
import { Button, Txt } from "@/components/ui";
import { currentLocale } from "@/i18n";
import { useErrorText } from "@/lib/ui-helpers";
import { useFlash } from "@/lib/use-flash";
import { formatDecimal } from "@/lib/workouts-model";

import type { BodyProfileInput } from "../nutrition/api";
import { useSaveBodyProfile } from "../nutrition/hooks";

const ACTIVITIES = ["sedentary", "light", "moderate", "active", "very_active"] as const;
const GOALS = ["cut", "maintain", "bulk"] as const;

type Detail = NonNullable<NutritionOverviewResponse["bodyProfile"]>;

const inRange = (value: number, { min, max }: { min: number; max: number }) =>
  value >= min && value <= max;

// The trainee's measurements and the energy plan the API worked out; the form
// saves them (the target follows the TDEE unless the PT set it by hand).
export const BodyProfileCard = ({
  detail,
  isTargetManual,
  today,
}: {
  detail: Detail | null;
  isTargetManual: boolean;
  today: string;
}) => {
  const { t } = useTranslation();
  const errorText = useErrorText();
  const locale = currentLocale();
  const save = useSaveBodyProfile();
  const [message, flash] = useFlash();
  const profile = detail?.profile ?? null;
  const [editing, setEditing] = useState(profile === null);
  const [sex, setSex] = useState<BodyProfileInput["sex"]>(profile?.sex ?? "male");
  const [age, setAge] = useState(profile ? String(Number(today.slice(0, 4)) - profile.birthYear) : "");
  const [height, setHeight] = useState(profile ? formatDecimal(profile.heightCm, locale) : "");
  const [weight, setWeight] = useState(profile ? formatDecimal(profile.weightKg, locale) : "");
  const [activity, setActivity] = useState<BodyProfileInput["activityLevel"]>(profile?.activityLevel ?? "moderate");
  const [goal, setGoal] = useState<BodyProfileInput["goal"]>(profile?.goal ?? "maintain");
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    const ageValue = parseDecimal(age);
    const valid =
      Number.isInteger(ageValue) &&
      inRange(ageValue, BODY_LIMITS.AGE) &&
      inRange(parseDecimal(height), BODY_LIMITS.HEIGHT_CM) &&
      inRange(parseDecimal(weight), BODY_LIMITS.WEIGHT_KG);

    if (!valid) {
      setError(t("nutri.body.invalid"));
      return;
    }
    setError(null);
    save.mutate(
      { sex, age: age.trim(), heightCm: height.trim(), weightKg: weight.trim(), activityLevel: activity, goal },
      {
        onSuccess: (result) => {
          flash(
            result.targetApplied
              ? t("nutri.body.appliedTarget")
              : isTargetManual
                ? t("nutri.body.keptManual")
                : t("nutri.body.saved"),
          );
          setEditing(false);
        },
        onError: (caught) => Alert.alert(errorText(caught)),
      },
    );
  };

  const plan = detail?.energyPlan;

  return (
    <Card>
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <Txt size={17} weight="700" style={{ flex: 1 }}>
          {t("nutri.body.title")}
        </Txt>
        {profile && !editing ? (
          <Button label={t("nutri.body.edit")} variant="ghost" onPress={() => setEditing(true)} />
        ) : null}
      </View>
      {!editing && profile && plan ? (
        <View style={{ gap: 4 }}>
          <Txt>
            {t(`nutri.body.${profile.sex}`)} · {t("nutri.body.ageYears", { age: plan.age })} · {formatDecimal(profile.heightCm, locale)} cm ·{" "}
            {formatDecimal(profile.weightKg, locale)} kg
          </Txt>
          <Txt tone="muted" size={14}>
            {t(`nutri.body.activity.${profile.activityLevel}`)} · {t(`nutri.body.goal.${profile.goal}`)}
          </Txt>
          <Txt size={13} tone="muted">
            {t("nutri.body.bmr", { kcal: Math.round(plan.bmr) })} · {t("nutri.body.tdee", { kcal: Math.round(plan.tdee) })}
          </Txt>
          <Txt weight="600" tone="accent">
            {t("nutri.body.target", { kcal: Math.round(plan.targetCalories) })}
          </Txt>
        </View>
      ) : null}
      {!editing && !profile ? (
        <Txt size={14} tone="muted">
          {t("nutri.body.empty")}
        </Txt>
      ) : null}
      {editing ? (
        <View style={{ gap: 12 }}>
          {profile === null ? (
            <Txt size={14} tone="muted">
              {t("nutri.body.empty")}
            </Txt>
          ) : null}
          <Txt size={13} weight="600" tone="muted">
            {t("nutri.body.sex")}
          </Txt>
          <Chips
            value={sex}
            onChange={setSex}
            options={[
              { value: "male", label: t("nutri.body.male") },
              { value: "female", label: t("nutri.body.female") },
            ]}
          />
          <Field label={t("nutri.body.age")} value={age} onChangeText={setAge} keyboardType="number-pad" />
          <Field label={t("nutri.body.height")} value={height} onChangeText={setHeight} keyboardType="decimal-pad" />
          <Field label={t("nutri.body.weight")} value={weight} onChangeText={setWeight} keyboardType="decimal-pad" />
          <Txt size={13} weight="600" tone="muted">
            {t("nutri.body.activityLabel")}
          </Txt>
          <Chips
            value={activity}
            onChange={setActivity}
            options={ACTIVITIES.map((value) => ({ value, label: t(`nutri.body.activity.${value}`) }))}
          />
          <Txt size={13} weight="600" tone="muted">
            {t("nutri.body.goalLabel")}
          </Txt>
          <Chips
            value={goal}
            onChange={setGoal}
            options={GOALS.map((value) => ({ value, label: t(`nutri.body.goal.${value}`) }))}
          />
          {error ? (
            <Txt size={13} tone="danger" accessibilityRole="alert">
              {error}
            </Txt>
          ) : null}
          <Button label={t("nutri.body.save")} loading={save.isPending} onPress={submit} />
          {profile ? <Button label={t("common.cancel")} variant="ghost" onPress={() => setEditing(false)} /> : null}
        </View>
      ) : null}
      {message ? (
        <Txt size={13} tone="accent" accessibilityLiveRegion="polite">
          {message}
        </Txt>
      ) : null}
    </Card>
  );
};
