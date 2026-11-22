import type { NutritionOverviewResponse } from "@pt/contracts";
import { BODY_LIMITS, parseDecimal } from "@pt/contracts";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, View } from "react-native";

import { Card } from "@/components/Card";
import { Field } from "@/components/Field";
import { Button, Txt } from "@/components/ui";
import { currentLocale } from "@/i18n";
import { useErrorText } from "@/lib/ui-helpers";
import { useFlash } from "@/lib/use-flash";
import { formatDecimal } from "@/lib/workouts-model";
import { radius, space, useTheme } from "@/theme";

import { useSaveWeight } from "../nutrition/hooks";

const CHART_HEIGHT = 90;

// Average weight of the last 12 weeks as bars, plus today's weigh-in.
export const WeightCard = ({
  overview,
  today,
}: {
  overview: NutritionOverviewResponse;
  today: string;
}) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const errorText = useErrorText();
  const locale = currentLocale();
  const save = useSaveWeight();
  const [message, flash] = useFlash();
  const [text, setText] = useState(
    overview.todayWeight === null ? "" : formatDecimal(overview.todayWeight, locale),
  );
  const [error, setError] = useState<string | null>(null);
  const weeks = overview.weightWeeks;
  const values = weeks.flatMap((week) => (week.averageKg === null ? [] : [week.averageKg]));
  const min = values.length ? Math.min(...values) : 0;
  const max = values.length ? Math.max(...values) : 0;
  const { latest, weekChange } = overview.weightChange;

  const submit = () => {
    const value = parseDecimal(text);

    if (!(value >= BODY_LIMITS.WEIGHT_KG.min && value <= BODY_LIMITS.WEIGHT_KG.max)) {
      setError(t("nutri.weight.invalid"));
      return;
    }
    setError(null);
    save.mutate(
      { date: today, weightKg: text.trim() },
      {
        onSuccess: (result) =>
          flash(result.targetApplied ? t("nutri.weight.savedTarget") : t("nutri.weight.saved")),
        onError: (caught) => Alert.alert(errorText(caught)),
      },
    );
  };

  return (
    <Card>
      <Txt size={17} weight="700">
        {t("nutri.weight.title")}
      </Txt>
      {values.length === 0 ? (
        <Txt size={14} tone="muted">
          {t("nutri.weight.empty")}
        </Txt>
      ) : (
        <>
          <Txt weight="600">
            {t("nutri.weight.latest", { kg: formatDecimal(latest ?? values[values.length - 1], locale) })}
          </Txt>
          {weekChange !== null && weekChange !== undefined ? (
            <Txt size={13} tone="muted">
              {t("nutri.weight.vsLastWeek", {
                change: `${weekChange > 0 ? "+" : ""}${formatDecimal(weekChange, locale)}`,
              })}
            </Txt>
          ) : null}
          <View
            accessibilityLabel={t("nutri.weight.chart")}
            style={{ flexDirection: "row", alignItems: "flex-end", height: CHART_HEIGHT, gap: 4 }}
          >
            {weeks.map((week) => {
              const range = Math.max(max - min, 1);
              const height =
                week.averageKg === null
                  ? 0
                  : 14 + ((week.averageKg - min) / range) * (CHART_HEIGHT - 14);

              return (
                <View
                  key={week.weekStart}
                  style={{
                    flex: 1,
                    height,
                    borderRadius: radius.sm / 2,
                    backgroundColor: theme.accent,
                    opacity: week.averageKg === null ? 0 : 0.85,
                  }}
                />
              );
            })}
          </View>
        </>
      )}
      <Field
        label={overview.todayWeight === null ? t("nutri.weight.today") : t("nutri.weight.todayLogged")}
        value={text}
        onChangeText={setText}
        placeholder={t("nutri.weight.placeholder")}
        keyboardType="decimal-pad"
        error={error}
      />
      <Button label={t("nutri.weight.save")} loading={save.isPending} onPress={submit} />
      {message ? (
        <Txt size={13} tone="accent" accessibilityLiveRegion="polite" style={{ marginTop: space.xs }}>
          {message}
        </Txt>
      ) : null}
    </Card>
  );
};
