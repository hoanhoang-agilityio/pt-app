import { type FoodEntryResponse, NUTRITION_LIMITS } from "@pt/contracts";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Chips } from "@/components/Chips";
import { Field } from "@/components/Field";
import { FormSheet } from "@/components/Sheet/FormSheet";
import { Button, Txt } from "@/components/ui";
import { useErrorText } from "@/lib/ui-helpers";

import type { MealKind } from "../api";
import { useSaveFoodEntry } from "../hooks";

const MEALS: MealKind[] = ["breakfast", "lunch", "dinner", "snack"];
const text = (value: number | null | undefined) => (value == null ? "" : String(value));

// Free-text meal (the older log): create for a day, or edit an entry.
export const FoodEntrySheet = ({
  date,
  entry,
  onClose,
}: {
  date: string;
  entry: FoodEntryResponse | null;
  onClose: () => void;
}) => {
  const { t } = useTranslation();
  const errorText = useErrorText();
  const save = useSaveFoodEntry();
  const [meal, setMeal] = useState<MealKind>(entry?.meal ?? "lunch");
  const [description, setDescription] = useState(entry?.description ?? "");
  const [carbs, setCarbs] = useState(text(entry?.carbs));
  const [protein, setProtein] = useState(text(entry?.protein));
  const [fat, setFat] = useState(text(entry?.fat));
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    if (!description.trim() && !carbs.trim() && !protein.trim() && !fat.trim()) {
      setError(t("nutri.entries.empty"));
      return;
    }
    setError(null);
    save.mutate(
      {
        id: entry?.id ?? null,
        body: { date: entry?.date ?? date, meal, description, carbs, protein, fat },
      },
      { onSuccess: onClose, onError: (caught) => setError(errorText(caught)) },
    );
  };

  return (
    <FormSheet
      visible
      onClose={onClose}
      title={entry ? t("nutri.entries.editTitle") : t("nutri.entries.addTitle")}
    >
      <Txt size={13} weight="600" tone="muted">
        {t("nutri.entries.meal")}
      </Txt>
      <Chips
        value={meal}
        onChange={setMeal}
        options={MEALS.map((value) => ({ value, label: t(`nutri.meals.${value}`) }))}
      />
      <Field
        label={t("nutri.entries.what")}
        value={description}
        onChangeText={setDescription}
        placeholder={t("nutri.entries.whatPlaceholder")}
        maxLength={NUTRITION_LIMITS.DESCRIPTION}
        multiline
      />
      <Txt size={13} weight="600" tone="muted">
        {t("nutri.entries.estimate")}
      </Txt>
      <Field label={t("nutri.macro.carbs")} value={carbs} onChangeText={setCarbs} keyboardType="number-pad" />
      <Field label={t("nutri.macro.protein")} value={protein} onChangeText={setProtein} keyboardType="number-pad" />
      <Field label={t("nutri.macro.fat")} value={fat} onChangeText={setFat} keyboardType="number-pad" />
      {error ? (
        <Txt size={13} tone="danger" accessibilityRole="alert">
          {error}
        </Txt>
      ) : null}
      <Button label={t("common.save")} loading={save.isPending} onPress={submit} />
    </FormSheet>
  );
};

