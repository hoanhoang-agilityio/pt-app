import type { MealLogResponse } from "@pt/contracts";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Pressable, View } from "react-native";

import { Card } from "@/components/Card";
import { Field } from "@/components/Field";
import { Button, Divider, Txt } from "@/components/ui";
import { currentLocale } from "@/i18n";
import {
  formatGrams,
  formatKcal,
  formatNutrition,
  localizeFoodName,
  type LogNutrition,
  type MealView,
  nutritionOfFood,
} from "@/lib/nutrition-model";
import { confirmAction, useErrorText } from "@/lib/ui-helpers";
import { useFlash } from "@/lib/use-flash";
import { space, useTheme } from "@/theme";

import { useRemoveMealLog, useSetMealMark } from "../hooks";

const MarkPanel = ({ view }: { view: MealView }) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const errorText = useErrorText();
  const mark = useSetMealMark();
  const [message, flash] = useFlash();
  const [note, setNote] = useState(view.mark?.note ?? "");
  const achieved = view.mark?.achieved ?? false;
  const save = (nextAchieved: boolean, nextNote: string) =>
    mark.mutate(
      { mealId: view.id, body: { achieved: nextAchieved, note: nextNote } },
      { onSuccess: () => flash(t("nutri.mark.saved")), onError: (e) => Alert.alert(errorText(e)) },
    );

  return (
    <View style={{ gap: space.sm }}>
      <Pressable
        accessibilityRole="switch"
        accessibilityState={{ checked: achieved, busy: mark.isPending }}
        accessibilityLabel={t("nutri.mark.achievedHint")}
        disabled={mark.isPending}
        onPress={() => save(!achieved, view.mark?.note ?? "")}
        style={{
          minHeight: 48,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: achieved ? theme.success : theme.line,
          backgroundColor: achieved ? `${theme.success}1f` : "transparent",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: space.sm,
        }}
      >
        <Txt weight="700" style={{ color: achieved ? theme.success : theme.fg }}>
          {achieved ? "✓ " : ""}
          {t("nutri.mark.achieved")}
        </Txt>
        <Txt size={12} tone="muted">
          {t("nutri.mark.achievedHint")}
        </Txt>
      </Pressable>
      <Field
        label={t("nutri.mark.note")}
        value={note}
        onChangeText={setNote}
        placeholder={t("nutri.mark.notePlaceholder")}
        maxLength={300}
        multiline
        style={{ minHeight: 64 }}
      />
      {note.trim() !== (view.mark?.note ?? "") ? (
        <Button
          label={t("nutri.mark.save")}
          variant="secondary"
          loading={mark.isPending}
          onPress={() => save(achieved, note)}
        />
      ) : null}
      {message ? (
        <Txt size={13} tone="accent" accessibilityLiveRegion="polite">
          {message}
        </Txt>
      ) : null}
    </View>
  );
};

const LogRow = ({
  log,
  loggable,
  onEdit,
}: {
  log: MealLogResponse;
  loggable: boolean;
  onEdit: (log: MealLogResponse) => void;
}) => {
  const { t } = useTranslation();
  const errorText = useErrorText();
  const remove = useRemoveMealLog();
  const locale = currentLocale();
  const nutrition: LogNutrition | null = log.nutrition;

  return (
    <View style={{ gap: 2 }}>
      <Txt weight="600">{localizeFoodName(log, locale)}</Txt>
      <Txt size={12} tone="muted">
        {[log.grams > 0 ? `${formatGrams(log.grams, locale)} g` : "", nutrition ? formatNutrition(nutrition, locale) : t("nutri.meal.noNutrition")]
          .filter(Boolean)
          .join(" · ")}
      </Txt>
      {log.isArchived ? (
        <Txt size={12} tone="muted">
          {t("nutri.meal.archived")}
        </Txt>
      ) : null}
      {log.isMissingFood ? (
        <Txt size={12} tone="danger">
          {t("nutri.meal.missingFood")}
        </Txt>
      ) : null}
      {loggable ? (
        <View style={{ flexDirection: "row", gap: space.lg }}>
          {!log.isMissingFood ? (
            <Pressable accessibilityRole="button" hitSlop={8} onPress={() => onEdit(log)}>
              <Txt size={13} tone="accent" weight="600">
                {t("common.edit")}
              </Txt>
            </Pressable>
          ) : null}
          <Pressable
            accessibilityRole="button"
            hitSlop={8}
            disabled={remove.isPending}
            onPress={() =>
              confirmAction({
                title: t("nutri.meal.removeConfirm"),
                confirmLabel: t("common.delete"),
                cancelLabel: t("common.cancel"),
                destructive: true,
                onConfirm: () =>
                  remove.mutate(log.id, { onError: (e) => Alert.alert(errorText(e)) }),
              })
            }
          >
            <Txt size={13} tone="danger" weight="600">
              {t("common.delete")}
            </Txt>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
};

// One planned meal: the PT's items, what the trainee ate, "Dat" and the note.
export const MealCard = ({
  view,
  index,
  target,
  loggable,
  onAdd,
  onEdit,
}: {
  view: MealView;
  index: number;
  target: LogNutrition | null;
  loggable: boolean;
  onAdd: (mealId: number) => void;
  onEdit: (mealId: number, log: MealLogResponse) => void;
}) => {
  const { t } = useTranslation();
  const locale = currentLocale();
  const planned = view.planned;
  const extra = view.logs;
  const plannedFoodIds = new Set(view.items.map((item) => item.foodId));

  return (
    <Card>
      <View style={{ gap: 2 }}>
        <Txt size={17} weight="700">
          {t("nutri.meal.title", { index: index + 1, name: view.name })}
        </Txt>
        {target ? (
          <Txt size={12} tone="muted">
            {t("nutri.meal.target", {
              kcal: formatKcal(target.kcal),
              protein: formatGrams(target.protein, locale),
              carbs: formatGrams(target.carbs, locale),
              fat: formatGrams(target.fat, locale),
            })}
          </Txt>
        ) : null}
        <Txt size={13} tone="accent" weight="600">
          {t("nutri.meal.eaten", { eaten: formatKcal(view.eaten.kcal), planned: formatKcal(planned.kcal) })}
        </Txt>
      </View>

      <Divider />
      <Txt size={13} weight="600" tone="muted">
        {t("nutri.meal.ptPlan")}
      </Txt>
      {view.items.length === 0 ? (
        <Txt size={14} tone="muted">
          {t("nutri.meal.noFoods")}
        </Txt>
      ) : (
        view.items.map((item) => (
          <View key={item.id} style={{ flexDirection: "row", justifyContent: "space-between", gap: space.md }}>
            <View style={{ flex: 1 }}>
              <Txt>{localizeFoodName(item.food, locale)}</Txt>
              <Txt size={12} tone="muted">
                {formatNutrition(nutritionOfFood(item.food, item.grams), locale)}
              </Txt>
            </View>
            <Txt weight="600">{formatGrams(item.grams, locale)} g</Txt>
          </View>
        ))
      )}

      {extra.length > 0 ? (
        <>
          <Divider />
          <Txt size={13} weight="600" tone="muted">
            {extra.some((log) => log.foodId !== null && !plannedFoodIds.has(log.foodId)) || extra.some((log) => log.isFree)
              ? t("nutri.meal.extra")
              : t("nutri.log.addTitle")}
          </Txt>
          {extra.map((log) => (
            <LogRow key={log.id} log={log} loggable={loggable} onEdit={(entry) => onEdit(view.id, entry)} />
          ))}
        </>
      ) : null}

      {loggable ? (
        <>
          <Button label={t("nutri.meal.logEaten")} variant="secondary" onPress={() => onAdd(view.id)} />
          <MarkPanel view={view} />
        </>
      ) : (
        <Txt size={13} tone="muted">
          {t("nutri.plan.future")}
        </Txt>
      )}
    </Card>
  );
};
