import { MEAL_COUNT_LIMITS, MEAL_PLAN_LIMITS } from "@pt/contracts";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, View } from "react-native";

import { Card } from "@/components/Card";
import { Chips } from "@/components/Chips";
import { Field } from "@/components/Field";
import { Button, Txt } from "@/components/ui";
import { useErrorText } from "@/lib/ui-helpers";
import { useFlash } from "@/lib/use-flash";

import { useSavePreferences } from "../hooks";

const COUNTS = Array.from(
  { length: MEAL_COUNT_LIMITS.max - MEAL_COUNT_LIMITS.min + 1 },
  (_, index) => String(MEAL_COUNT_LIMITS.min + index),
);

// The trainee's request to the PT: meals per day and a food note.
export const PreferencesCard = ({
  preferredMealCount,
  foodNote,
}: {
  preferredMealCount: number | null;
  foodNote: string | null;
}) => {
  const { t } = useTranslation();
  const errorText = useErrorText();
  const save = useSavePreferences();
  const [message, flash] = useFlash();
  const [count, setCount] = useState(preferredMealCount === null ? "" : String(preferredMealCount));
  const [note, setNote] = useState(foodNote ?? "");

  return (
    <Card>
      <Txt size={17} weight="700">
        {t("nutri.prefs.title")}
      </Txt>
      <View style={{ gap: 6 }}>
        <Txt size={13} weight="600" tone="muted">
          {t("nutri.prefs.mealCount")}
        </Txt>
        <Chips
          scroll
          value={count}
          onChange={(value) => setCount(value === count ? "" : value)}
          options={COUNTS.map((value) => ({ value, label: value }))}
        />
        {count === "" ? (
          <Txt size={12} tone="muted">
            {t("nutri.prefs.mealAny")}
          </Txt>
        ) : null}
      </View>
      <Field
        label={t("nutri.prefs.foodNote")}
        value={note}
        onChangeText={setNote}
        placeholder={t("nutri.prefs.foodNotePlaceholder")}
        maxLength={MEAL_PLAN_LIMITS.FOOD_NOTE}
        multiline
      />
      <Button
        label={t("nutri.prefs.save")}
        loading={save.isPending}
        onPress={() =>
          save.mutate(
            { mealCount: count, foodNote: note },
            {
              onSuccess: () => flash(t("nutri.prefs.saved")),
              onError: (error) => Alert.alert(errorText(error)),
            },
          )
        }
      />
      {message ? (
        <Txt size={13} tone="accent" accessibilityLiveRegion="polite">
          {message}
        </Txt>
      ) : null}
    </Card>
  );
};
