import type { ScheduleExerciseResponse } from "@pt/contracts";
import { SET_LIMITS } from "@pt/contracts";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Pressable, StyleSheet, TextInput, View } from "react-native";

import { Button, Txt } from "@/components/ui";
import { currentLocale } from "@/i18n";
import { useErrorText } from "@/lib/ui-helpers";
import { useFlash } from "@/lib/use-flash";
import {
  createInitialRows,
  formatSet,
  getRowHint,
  hintToDraftValues,
  isEmptyFirstSave,
  type LoggedSet,
  rowsToSetInputs,
  type SetRowDraft,
  type SetRowField,
} from "@/lib/workouts-model";
import { radius, space, useTheme } from "@/theme";

import { useSaveSets } from "../hooks";

// Weight and reps per set for one exercise (today or a past day). The parent
// keys it by the saved sets, so rows restart only when the server list changes.
export const SetLogger = ({ exercise }: { exercise: ScheduleExerciseResponse }) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const errorText = useErrorText();
  const locale = currentLocale();
  const save = useSaveSets(exercise.id);
  const [message, flash] = useFlash();
  const [rows, setRows] = useState<SetRowDraft[]>(() =>
    createInitialRows(exercise.loggedSets, exercise.sets),
  );
  const nextId = useRef(rows.length);
  const canAdd = rows.length < SET_LIMITS.MAX_ROWS;

  const update = (id: number, field: SetRowField, value: string) =>
    setRows((current) =>
      current.map((row) => (row.id === id ? { ...row, [field]: value } : row)),
    );
  const applyHint = (id: number, hint: LoggedSet) =>
    setRows((current) =>
      current.map((row) => (row.id === id ? { ...row, ...hintToDraftValues(hint) } : row)),
    );
  const addRow = () => {
    const id = nextId.current;

    nextId.current += 1;
    setRows((current) =>
      current.length < SET_LIMITS.MAX_ROWS
        ? [...current, { id, weight: "", reps: "" }]
        : current,
    );
  };
  const removeRow = (id: number) =>
    setRows((current) =>
      current.length > 1 ? current.filter((row) => row.id !== id) : current,
    );

  const onSave = () => {
    const parsed = rowsToSetInputs(rows);

    if (!parsed.ok) {
      Alert.alert(t(`train.logger.err.${parsed.error}`, { n: parsed.setNumber }));
      return;
    }
    if (isEmptyFirstSave(parsed.sets.length, exercise.loggedSets.length)) {
      Alert.alert(t("train.logger.nothingToSave"));
      return;
    }
    save.mutate(parsed.sets, {
      onSuccess: (result) =>
        flash(result.personalBest ? t("train.logger.personalBest") : t("train.logger.saved")),
      onError: (error) => Alert.alert(errorText(error)),
    });
  };

  const input = [
    styles.input,
    { color: theme.fg, borderColor: theme.line, backgroundColor: theme.bg },
  ];

  return (
    <View style={[styles.box, { borderColor: theme.line }]}>
      <View style={styles.row}>
        <Txt size={12} tone="muted" weight="600" style={styles.index}>
          #
        </Txt>
        <Txt size={12} tone="muted" weight="600" style={styles.field}>
          {t("train.logger.weightUnit")}
        </Txt>
        <Txt size={12} tone="muted" weight="600" style={styles.field}>
          {t("train.logger.repsUnit")}
        </Txt>
        <View style={styles.remove} />
      </View>
      {rows.map((row, index) => {
        const hint = getRowHint(exercise.previousSets, index);

        return (
          <View key={row.id} style={{ gap: 4 }}>
            <View style={styles.row}>
              <Txt weight="600" tone="muted" style={styles.index}>
                {index + 1}
              </Txt>
              <TextInput
                accessibilityLabel={t("train.logger.weightUnit")}
                value={row.weight}
                onChangeText={(value) => update(row.id, "weight", value)}
                keyboardType="decimal-pad"
                placeholder={hint?.weightKg != null ? String(hint.weightKg) : t("train.logger.weightPlaceholder")}
                placeholderTextColor={theme.muted}
                editable={!save.isPending}
                style={[...input, styles.field]}
              />
              <TextInput
                accessibilityLabel={t("train.logger.repsUnit")}
                value={row.reps}
                onChangeText={(value) => update(row.id, "reps", value)}
                keyboardType="number-pad"
                placeholder={hint ? String(hint.reps) : t("train.logger.repsPlaceholder")}
                placeholderTextColor={theme.muted}
                editable={!save.isPending}
                style={[...input, styles.field]}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("train.logger.removeRow", { n: index + 1 })}
                disabled={rows.length <= 1 || save.isPending}
                onPress={() => removeRow(row.id)}
                style={[styles.remove, rows.length <= 1 && { opacity: 0.3 }]}
              >
                <Txt tone="muted" size={20}>
                  ×
                </Txt>
              </Pressable>
            </View>
            {hint ? (
              <Pressable onPress={() => applyHint(row.id, hint)} style={{ paddingLeft: 30 }}>
                <Txt size={12} tone="accent">
                  {t("train.logger.hint", {
                    set: formatSet(hint, t("train.logger.bodyweight"), locale),
                  })}
                </Txt>
              </Pressable>
            ) : null}
          </View>
        );
      })}
      <Txt size={12} tone="muted">
        {t("train.logger.bodyweightHint")}
      </Txt>
      <View style={{ flexDirection: "row", gap: space.sm }}>
        <Button
          label={t("train.logger.addRow")}
          variant="secondary"
          disabled={!canAdd}
          onPress={addRow}
          style={{ flex: 1 }}
        />
        <Button
          label={save.isPending ? t("train.logger.saving") : t("train.logger.save")}
          loading={save.isPending}
          onPress={onSave}
          style={{ flex: 1 }}
        />
      </View>
      {message ? (
        <Txt size={13} tone="accent" accessibilityLiveRegion="polite" style={{ textAlign: "center" }}>
          {message}
        </Txt>
      ) : null}
    </View>
  );
};

// Sets already logged, read-only (timed exercises, preview).
export const LoggedSets = ({ sets }: { sets: LoggedSet[] }) => {
  const { t } = useTranslation();
  const locale = currentLocale();

  return (
    <View style={{ paddingHorizontal: space.lg, paddingBottom: space.md, gap: 2 }}>
      <Txt size={13} tone="muted">
        {sets.length === 0
          ? t("train.logged.none")
          : `${t("train.logged.prefix")} ${sets
              .map((set) => formatSet(set, t("train.logger.bodyweight"), locale))
              .join(" · ")}`}
      </Txt>
    </View>
  );
};

const styles = StyleSheet.create({
  box: {
    borderTopWidth: StyleSheet.hairlineWidth,
    padding: space.lg,
    gap: space.sm,
  },
  row: { flexDirection: "row", alignItems: "center", gap: space.sm },
  index: { width: 22, textAlign: "center" },
  field: { flex: 1, textAlign: "center" },
  remove: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  input: {
    minHeight: 44,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth * 2,
    paddingHorizontal: space.md,
    fontSize: 16,
  },
});
