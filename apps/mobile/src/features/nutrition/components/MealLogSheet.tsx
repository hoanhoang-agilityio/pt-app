import {
  type FoodResponse,
  MEAL_LOG_LIMITS,
  type MealLogResponse,
} from "@pt/contracts";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Pressable, View } from "react-native";

import { Field } from "@/components/Field";
import { FormSheet } from "@/components/Sheet/FormSheet";
import { Button, Spinner, Txt } from "@/components/ui";
import { currentLocale } from "@/i18n";
import { formatGrams, localizeFoodName, parseOptionalNumber } from "@/lib/nutrition-model";
import { useErrorText } from "@/lib/ui-helpers";
import { space, useTheme } from "@/theme";

import { useAddMealLog, useFoodSearch, useUpdateMealLog } from "../hooks";

type Step = "search" | "amount" | "free";
const MACRO_FIELDS = ["kcal", "protein", "carbs", "fat"] as const;
type MacroField = (typeof MACRO_FIELDS)[number];

const maxOf = (field: MacroField) =>
  field === "kcal" ? MEAL_LOG_LIMITS.MAX_KCAL : MEAL_LOG_LIMITS.MAX_MACRO_GRAMS;
const fieldText = (value: number | null | undefined) =>
  value == null ? "" : formatGrams(value);
const useDebounced = (value: string, ms = 300) => {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), ms);

    return () => clearTimeout(timer);
  }, [value, ms]);
  return debounced;
};

// Adds a food to a planned meal (library search then grams, or a free food),
// or edits an existing log of it.
export const MealLogSheet = ({
  mealId,
  editing,
  onClose,
  onDone,
}: {
  mealId: number;
  editing: MealLogResponse | null;
  onClose: () => void;
  onDone: (edited: boolean) => void;
}) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const errorText = useErrorText();
  const locale = currentLocale();
  const add = useAddMealLog(mealId);
  const update = useUpdateMealLog();
  const [step, setStep] = useState<Step>(() => (!editing ? "search" : editing.isFree ? "free" : "amount"));
  const [query, setQuery] = useState("");
  const [food, setFood] = useState<FoodResponse | null>(null);
  const [grams, setGrams] = useState(editing ? fieldText(editing.grams) : "");
  const [name, setName] = useState(editing?.isFree ? editing.name : "");
  const [macros, setMacros] = useState<Record<MacroField, string>>({
    kcal: fieldText(editing?.typed.kcal),
    protein: fieldText(editing?.typed.protein),
    carbs: fieldText(editing?.typed.carbs),
    fat: fieldText(editing?.typed.fat),
  });
  const [error, setError] = useState<string | null>(null);
  const search = useFoodSearch(useDebounced(query), null, locale, step === "search");
  const pending = add.isPending || update.isPending;

  const fail = (caught: unknown) => Alert.alert(errorText(caught));
  const done = (edited: boolean) => onDone(edited);

  const parseGrams = (): number | null => {
    const value = parseOptionalNumber(grams, 3000);

    return value === "invalid" ? null : (value ?? 0);
  };

  const submit = () => {
    const amount = parseGrams();

    if (amount === null) {
      setError(t("nutri.log.invalidNumber"));
      return;
    }
    if (step === "amount") {
      if (amount <= 0) {
        setError(t("nutri.log.gramsRequired"));
        return;
      }
      setError(null);
      if (editing) {
        update.mutate({ id: editing.id, body: { grams: amount } }, { onSuccess: () => done(true), onError: fail });
      } else if (food) {
        add.mutate({ kind: "library", foodId: food.id, grams: amount }, { onSuccess: () => done(false), onError: fail });
      }
      return;
    }
    if (!name.trim()) {
      setError(t("nutri.log.nameRequired"));
      return;
    }
    const typed = {} as Record<MacroField, number | null>;

    for (const field of MACRO_FIELDS) {
      const value = parseOptionalNumber(macros[field], maxOf(field));

      if (value === "invalid") {
        setError(t("nutri.log.invalidNumber"));
        return;
      }
      typed[field] = value;
    }
    setError(null);
    if (editing) {
      update.mutate(
        { id: editing.id, body: { customName: name, grams: amount, ...typed } },
        { onSuccess: () => done(true), onError: fail },
      );
    } else {
      add.mutate(
        { kind: "free", customName: name, grams: amount, ...typed },
        { onSuccess: () => done(false), onError: fail },
      );
    }
  };

  const title = editing ? t("nutri.log.editTitle") : t("nutri.log.addTitle");

  return (
    <FormSheet visible onClose={onClose} title={title}>
      {step === "search" ? (
        <>
          <Field
            value={query}
            onChangeText={setQuery}
            placeholder={t("nutri.log.searchPlaceholder")}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
          />
          {search.isPending ? (
            <Spinner />
          ) : search.foods.length === 0 ? (
            <Txt tone="muted" style={{ textAlign: "center", padding: space.lg }}>
              {t("nutri.log.noResults")}
            </Txt>
          ) : (
            <View>
              {search.foods.map((item) => (
                <Pressable
                  key={item.id}
                  accessibilityRole="button"
                  onPress={() => {
                    setFood(item);
                    setStep("amount");
                    setError(null);
                  }}
                  style={{ minHeight: 52, justifyContent: "center", gap: 2 }}
                >
                  <Txt weight="600">{localizeFoodName(item, locale)}</Txt>
                  <Txt size={12} tone="muted">
                    {`${Math.round(item.kcal)} kcal · P ${formatGrams(item.protein, locale)} · C ${formatGrams(item.carbs, locale)} · F ${formatGrams(item.fat, locale)} / 100 g`}
                  </Txt>
                </Pressable>
              ))}
              {search.hasNextPage ? (
                <Txt size={12} tone="muted" style={{ paddingVertical: space.sm }}>
                  {t("nutri.log.moreResults")}
                </Txt>
              ) : null}
            </View>
          )}
          <Button label={t("nutri.log.freeFood")} variant="secondary" onPress={() => setStep("free")} />
        </>
      ) : null}

      {step === "amount" ? (
        <>
          <Txt weight="600">{editing ? editing.name : food ? localizeFoodName(food, locale) : ""}</Txt>
          <Field
            label={t("nutri.log.grams")}
            value={grams}
            onChangeText={setGrams}
            keyboardType="decimal-pad"
            autoFocus
            error={error}
          />
          <Button label={editing ? t("common.save") : t("nutri.log.add")} loading={pending} onPress={submit} />
          {!editing ? (
            <Button label={t("nutri.log.pickOther")} variant="ghost" onPress={() => setStep("search")} />
          ) : null}
        </>
      ) : null}

      {step === "free" ? (
        <>
          <Field
            label={t("nutri.log.name")}
            value={name}
            onChangeText={setName}
            placeholder={t("nutri.log.namePlaceholder")}
            maxLength={MEAL_LOG_LIMITS.CUSTOM_NAME}
          />
          <Field
            label={t("nutri.log.gramsOptional")}
            value={grams}
            onChangeText={setGrams}
            keyboardType="decimal-pad"
          />
          <Txt size={13} weight="600" tone="muted">
            {t("nutri.log.nutritionOptional")}
          </Txt>
          {MACRO_FIELDS.map((field) => (
            <Field
              key={field}
              label={t(`nutri.log.${field}`)}
              value={macros[field]}
              onChangeText={(value) => setMacros((current) => ({ ...current, [field]: value }))}
              keyboardType="decimal-pad"
            />
          ))}
          {error ? (
            <Txt size={13} style={{ color: theme.danger }} accessibilityRole="alert">
              {error}
            </Txt>
          ) : null}
          <Button label={editing ? t("common.save") : t("nutri.log.add")} loading={pending} onPress={submit} />
          {!editing ? (
            <Button label={t("nutri.log.searchLibrary")} variant="ghost" onPress={() => setStep("search")} />
          ) : null}
        </>
      ) : null}
    </FormSheet>
  );
};
