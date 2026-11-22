import { useTranslation } from "react-i18next";
import { View } from "react-native";

import { ProgressBar } from "@/components/ProgressBar";
import { Txt } from "@/components/ui";
import { currentLocale } from "@/i18n";
import {
  type ComparedMetric,
  compareToTarget,
  formatGrams,
  formatKcal,
  kcalOf,
  type LogNutrition,
  type Macro,
  MACROS,
  ringPercent,
} from "@/lib/nutrition-model";
import { useTheme } from "@/theme";

const Row = ({
  label,
  eaten,
  target,
  unit,
  metric,
}: {
  label: string;
  eaten: number;
  target: number | undefined;
  unit: string;
  metric: ComparedMetric;
}) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const locale = currentLocale();
  const status = compareToTarget(eaten, target, metric).status;
  const tone = status === "over" ? "danger" : status === "on" ? "success" : "accent";
  const fmt = unit === "kcal" ? formatKcal : (value: number) => formatGrams(value, locale);

  return (
    <View style={{ gap: 4 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Txt weight="600" size={14}>
          {label}
        </Txt>
        <Txt size={13} tone="muted">
          {fmt(eaten)}
          {target ? ` / ${fmt(target)}` : ""} {unit}
          {target && status !== "none" ? (
            <Txt
              size={13}
              weight="600"
              style={{ color: status === "over" ? theme.danger : status === "on" ? theme.success : theme.muted }}
            >
              {` · ${t(`nutri.status.${status}`)}`}
            </Txt>
          ) : null}
        </Txt>
      </View>
      {target ? (
        <ProgressBar percent={ringPercent(eaten, target)} tone={tone} label={label} />
      ) : null}
    </View>
  );
};

// kcal and the three macros of a day against its target (grams per macro, kcal
// from 4/4/9).
export const MacroProgress = ({
  totals,
  kcal,
  target,
}: {
  totals: Pick<LogNutrition, Macro>;
  kcal: number;
  target: Record<Macro, number> | null;
}) => {
  const { t } = useTranslation();

  return (
    <View style={{ gap: 12 }}>
      <Row
        label={t("nutri.energy")}
        eaten={kcal}
        target={target ? kcalOf(target) : undefined}
        unit="kcal"
        metric="kcal"
      />
      {MACROS.map((macro) => (
        <Row
          key={macro}
          label={t(`nutri.macro.${macro}`)}
          eaten={totals[macro]}
          target={target?.[macro]}
          unit="g"
          metric={macro}
        />
      ))}
    </View>
  );
};
