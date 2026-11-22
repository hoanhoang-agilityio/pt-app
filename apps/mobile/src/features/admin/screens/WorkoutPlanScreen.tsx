import { Ionicons } from "@expo/vector-icons";
import { getYoutubeWatchUrl, type ScheduleDayResponse } from "@pt/contracts";
import { addDays } from "@pt/contracts";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Pressable, View } from "react-native";

import { Button, Txt } from "@/components/ui";
import {
  currentWeekStart,
  exerciseBody,
  type ExerciseForm,
  shiftWeek,
  shortDate,
  today,
  weekDates,
  weekdayIndex,
  weekRange,
} from "@/lib/admin-utils";
import { isApiError } from "@/lib/errors";
import { confirmAction, useErrorText } from "@/lib/ui-helpers";
import { space, useTheme } from "@/theme";

import {
  addExercise,
  copyWorkoutDay,
  copyWorkoutWeek,
  deleteExercise,
  fetchTrainees,
  fetchWorkoutCopyInfo,
  fetchWorkoutWeek,
  moveExercise,
  saveWorkoutDay,
  updateExercise,
} from "../api";
import { Banner, Card, Chip, ChipRow, Field, FormSheet, Loaded, Page, Pill, useFormError } from "../components/kit";
import { ak } from "../keys";
import { useTraineeId } from "./TraineeDetailScreen";

type ExerciseItem = ScheduleDayResponse["exercises"][number];

const EMPTY_EXERCISE: ExerciseForm = { title: "", youtubeUrl: "", sets: "", reps: "", description: "" };

const weekdayLabel = (t: (key: string) => string, date: string) => t(`admin.weekday.${weekdayIndex(date)}`);

export const WorkoutPlanScreen = () => {
  const { t } = useTranslation();
  const theme = useTheme();
  const queryClient = useQueryClient();
  const errorText = useErrorText();
  const userId = useTraineeId();
  const [week, setWeek] = useState(currentWeekStart);
  const range = weekRange(week);
  const query = useQuery({
    queryKey: ak.workoutWeek(userId, week),
    queryFn: () => fetchWorkoutWeek(userId, range.from, range.to),
  });
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ["admin", "trainee", userId, "workouts"] });
  const dates = useMemo(() => weekDates(week), [week]);
  const [dayDate, setDayDate] = useState<string | null>(null);
  const [dayForm, setDayForm] = useState({ title: "", note: "" });
  const [exercise, setExercise] = useState<{ date: string; id: number | null } | null>(null);
  const [exerciseForm, setExerciseForm] = useState<ExerciseForm>(EMPTY_EXERCISE);
  const [copyDate, setCopyDate] = useState<string | null>(null);
  const [copyWeekOpen, setCopyWeekOpen] = useState(false);
  const form = useFormError();
  const [busy, setBusy] = useState(false);

  const fail = (error: unknown) => Alert.alert(errorText(error));

  const submitDay = async () => {
    if (!dayDate) {
      return;
    }
    setBusy(true);
    form.clear();
    try {
      await saveWorkoutDay(userId, dayDate, dayForm);
      setDayDate(null);
      await refresh();
    } catch (error) {
      form.setError(error);
    } finally {
      setBusy(false);
    }
  };

  // A new video link deletes the trainee's logged sets: ask first, then resend.
  const submitExercise = async (confirmReset = false): Promise<void> => {
    if (!exercise) {
      return;
    }
    setBusy(true);
    form.clear();
    try {
      const body = exerciseBody(exerciseForm, confirmReset);

      if (exercise.id === null) {
        await addExercise(userId, exercise.date, body);
      } else {
        await updateExercise(userId, exercise.id, body);
      }
      setExercise(null);
      await refresh();
    } catch (error) {
      if (isApiError(error) && error.code === "LINK_CHANGE_NEEDS_CONFIRM") {
        confirmAction({
          title: t("admin.workouts.linkChangeTitle"),
          message: error.message,
          confirmLabel: t("admin.workouts.linkChangeConfirm"),
          cancelLabel: t("common.cancel"),
          destructive: true,
          onConfirm: () => void submitExercise(true),
        });
      } else {
        form.setError(error);
      }
    } finally {
      setBusy(false);
    }
  };

  const removeExercise = (item: ExerciseItem, confirmSets = false): void => {
    void deleteExercise(userId, item.id, confirmSets)
      .then(refresh)
      .catch((error: unknown) => {
        if (isApiError(error) && error.code === "EXERCISE_HAS_SETS") {
          confirmAction({
            title: t("admin.workouts.deleteWithSets"),
            message: error.message,
            confirmLabel: t("common.delete"),
            cancelLabel: t("common.cancel"),
            destructive: true,
            onConfirm: () => removeExercise(item, true),
          });
        } else {
          fail(error);
        }
      });
  };

  const move = (item: ExerciseItem, direction: "up" | "down") =>
    void moveExercise(userId, item.id, direction).then(refresh).catch(fail);

  const openExercise = (date: string, item?: ExerciseItem) => {
    form.clear();
    setExerciseForm(
      item
        ? {
            title: item.title,
            youtubeUrl: item.youtubeId ? getYoutubeWatchUrl(item.youtubeId) : "",
            sets: item.sets === null ? "" : String(item.sets),
            reps: item.reps,
            description: item.description,
          }
        : EMPTY_EXERCISE,
    );
    setExercise({ date, id: item?.id ?? null });
  };

  return (
    <Page
      title={t("admin.trainee.workouts")}
      refreshing={query.isRefetching}
      onRefresh={() => void query.refetch()}
      headerRight={() => (
        <Pressable hitSlop={10} accessibilityRole="button" accessibilityLabel={t("admin.workouts.copyWeek")} onPress={() => setCopyWeekOpen(true)}>
          <Ionicons name="copy-outline" size={22} color={theme.accent} />
        </Pressable>
      )}
    >
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
            {dates.map((date) => {
              const day = data.days.find((d) => d.date === date);
              const isToday = date === today();

              return (
                <Card key={date} gap={space.sm}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
                    <View style={{ flex: 1 }}>
                      <Txt weight="700">
                        {weekdayLabel(t, date)} · {shortDate(date)}
                        {day?.title ? ` · ${day.title}` : ""}
                      </Txt>
                      {day?.note ? (
                        <Txt size={13} tone="muted">
                          {day.note}
                        </Txt>
                      ) : null}
                    </View>
                    {isToday ? <Pill label={t("admin.week.today")} tone="accent" /> : null}
                    <Pressable
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel={t("admin.workouts.editDay")}
                      onPress={() => {
                        form.clear();
                        setDayForm({ title: day?.title ?? "", note: day?.note ?? "" });
                        setDayDate(date);
                      }}
                    >
                      <Ionicons name="create-outline" size={20} color={theme.muted} />
                    </Pressable>
                    {day && day.exercises.length > 0 ? (
                      <Pressable
                        hitSlop={8}
                        accessibilityRole="button"
                        accessibilityLabel={t("admin.workouts.copyDay")}
                        onPress={() => setCopyDate(date)}
                      >
                        <Ionicons name="copy-outline" size={20} color={theme.muted} />
                      </Pressable>
                    ) : null}
                  </View>

                  {(day?.exercises ?? []).map((item, index, all) => (
                    <View
                      key={item.id}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: space.sm,
                        borderTopWidth: 1,
                        borderTopColor: theme.line,
                        paddingTop: space.sm,
                      }}
                    >
                      <Ionicons
                        name={item.completedAt ? "checkmark-circle" : "ellipse-outline"}
                        size={20}
                        color={item.completedAt ? theme.success : theme.muted}
                      />
                      <Pressable style={{ flex: 1 }} onPress={() => openExercise(date, item)}>
                        <Txt weight="600">{item.title}</Txt>
                        <Txt size={13} tone="muted">
                          {[item.sets ? `${item.sets} ${t("admin.workouts.sets")}` : null, item.reps || null]
                            .filter(Boolean)
                            .join(" × ")}
                          {item.loggedSets.length > 0 ? ` · ${t("admin.workouts.logged", { count: item.loggedSets.length })}` : ""}
                        </Txt>
                      </Pressable>
                      <Pressable hitSlop={6} disabled={index === 0} onPress={() => move(item, "up")} accessibilityLabel={t("admin.workouts.moveUp")}>
                        <Ionicons name="arrow-up" size={18} color={index === 0 ? theme.line : theme.muted} />
                      </Pressable>
                      <Pressable hitSlop={6} disabled={index === all.length - 1} onPress={() => move(item, "down")} accessibilityLabel={t("admin.workouts.moveDown")}>
                        <Ionicons name="arrow-down" size={18} color={index === all.length - 1 ? theme.line : theme.muted} />
                      </Pressable>
                      <Pressable
                        hitSlop={6}
                        accessibilityLabel={t("common.delete")}
                        onPress={() =>
                          confirmAction({
                            title: t("admin.workouts.deleteExercise"),
                            confirmLabel: t("common.delete"),
                            cancelLabel: t("common.cancel"),
                            destructive: true,
                            onConfirm: () => removeExercise(item),
                          })
                        }
                      >
                        <Ionicons name="trash-outline" size={18} color={theme.danger} />
                      </Pressable>
                    </View>
                  ))}
                  <Button
                    variant="secondary"
                    label={t("admin.workouts.addExercise")}
                    onPress={() => openExercise(date)}
                  />
                </Card>
              );
            })}
          </>
        )}
      </Loaded>

      <FormSheet visible={dayDate !== null} title={t("admin.workouts.editDay")} onClose={() => setDayDate(null)}>
        <Field
          label={t("admin.workouts.dayTitle")}
          value={dayForm.title}
          onChangeText={(title) => setDayForm((f) => ({ ...f, title }))}
          maxLength={120}
          error={form.fieldError("title")}
        />
        <Field
          label={t("admin.workouts.dayNote")}
          value={dayForm.note}
          onChangeText={(note) => setDayForm((f) => ({ ...f, note }))}
          multiline
          maxLength={1000}
          error={form.fieldError("note")}
        />
        {form.message && !form.hasFields ? <Banner text={form.message} /> : null}
        <Button label={t("common.save")} loading={busy} onPress={() => void submitDay()} />
      </FormSheet>

      <FormSheet
        visible={exercise !== null}
        title={exercise?.id ? t("admin.workouts.editExercise") : t("admin.workouts.addExercise")}
        onClose={() => setExercise(null)}
      >
        <Field
          label={t("admin.workouts.exerciseTitle")}
          value={exerciseForm.title}
          onChangeText={(title) => setExerciseForm((f) => ({ ...f, title }))}
          maxLength={120}
          error={form.fieldError("title")}
        />
        <Field
          label={t("admin.workouts.youtube")}
          value={exerciseForm.youtubeUrl}
          onChangeText={(youtubeUrl) => setExerciseForm((f) => ({ ...f, youtubeUrl }))}
          autoCapitalize="none"
          keyboardType="url"
          error={form.fieldError("youtubeUrl")}
        />
        <View style={{ flexDirection: "row", gap: space.md }}>
          <View style={{ flex: 1 }}>
            <Field
              label={t("admin.workouts.sets")}
              value={exerciseForm.sets}
              onChangeText={(sets) => setExerciseForm((f) => ({ ...f, sets: sets.replace(/\D/g, "") }))}
              keyboardType="number-pad"
              error={form.fieldError("sets")}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Field
              label={t("admin.workouts.reps")}
              value={exerciseForm.reps}
              onChangeText={(reps) => setExerciseForm((f) => ({ ...f, reps }))}
              maxLength={40}
              error={form.fieldError("reps")}
            />
          </View>
        </View>
        <Field
          label={t("admin.workouts.description")}
          value={exerciseForm.description}
          onChangeText={(description) => setExerciseForm((f) => ({ ...f, description }))}
          multiline
          maxLength={2000}
          error={form.fieldError("description")}
        />
        {form.message && !form.hasFields ? <Banner text={form.message} /> : null}
        <Button label={t("common.save")} loading={busy} onPress={() => void submitExercise()} />
      </FormSheet>

      <CopyDaySheet
        userId={userId}
        date={copyDate}
        onClose={() => setCopyDate(null)}
        onDone={() => {
          setCopyDate(null);
          void refresh();
        }}
      />
      <CopyWeekSheet
        userId={userId}
        week={week}
        visible={copyWeekOpen}
        onClose={() => setCopyWeekOpen(false)}
        onDone={() => {
          setCopyWeekOpen(false);
          void refresh();
        }}
      />
    </Page>
  );
};

// Copy one day to up to 14 later days (days with logged sets are locked).
const CopyDaySheet = ({
  userId,
  date,
  onClose,
  onDone,
}: {
  userId: number;
  date: string | null;
  onClose: () => void;
  onDone: () => void;
}) => {
  const { t } = useTranslation();
  const start = today();
  const targets = useMemo(() => Array.from({ length: 21 }, (_, i) => addDays(start, i)), [start]);
  const [picked, setPicked] = useState<string[]>([]);
  const form = useFormError();
  const [busy, setBusy] = useState(false);
  const info = useQuery({
    queryKey: ak.workoutCopyInfo(userId, start),
    queryFn: () => fetchWorkoutCopyInfo(userId, start, addDays(start, 41)),
    enabled: date !== null,
  });
  const locked = new Set(info.data?.logDates ?? []);
  const planned = new Set(info.data?.planDates ?? []);

  const submit = async () => {
    if (!date) {
      return;
    }
    setBusy(true);
    form.clear();
    try {
      await copyWorkoutDay(userId, { date, dates: picked });
      setPicked([]);
      onDone();
    } catch (error) {
      form.setError(error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <FormSheet visible={date !== null} title={t("admin.workouts.copyDay")} onClose={onClose}>
      <Txt size={13} tone="muted">
        {t("admin.workouts.copyDayHint")}
      </Txt>
      <ChipRow>
        {targets
          .filter((target) => target !== date && !locked.has(target))
          .map((target) => (
            <Chip
              key={target}
              label={`${weekdayLabel(t, target)} ${shortDate(target)}${planned.has(target) ? " •" : ""}`}
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
      <Txt size={12} tone="muted">
        {t("admin.workouts.overwriteLegend")}
      </Txt>
      {form.message ? <Banner text={form.message} /> : null}
      <Button
        label={t("admin.workouts.copyTo", { count: picked.length })}
        disabled={picked.length === 0}
        loading={busy}
        onPress={() => void submit()}
      />
    </FormSheet>
  );
};

// Copy the whole week to another week of this or another trainee.
const CopyWeekSheet = ({
  userId,
  week,
  visible,
  onClose,
  onDone,
}: {
  userId: number;
  week: string;
  visible: boolean;
  onClose: () => void;
  onDone: () => void;
}) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const [target, setTarget] = useState<number>(userId);
  const [targetWeek, setTargetWeek] = useState(() => shiftWeek(week, 1));
  const form = useFormError();
  const [busy, setBusy] = useState(false);
  const trainees = useQuery({
    queryKey: ak.trainees("", null),
    queryFn: () => fetchTrainees(""),
    enabled: visible,
  });

  const submit = async () => {
    setBusy(true);
    form.clear();
    try {
      const result = await copyWorkoutWeek(userId, {
        fromWeek: week,
        targetUserId: target,
        targetDate: targetWeek,
      });

      Alert.alert(t("admin.workouts.copiedDays", { count: result.copiedDays }));
      onDone();
    } catch (error) {
      form.setError(error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <FormSheet visible={visible} title={t("admin.workouts.copyWeek")} onClose={onClose}>
      <Txt size={13} tone="muted">
        {t("admin.workouts.copyWeekFrom", { from: shortDate(week) })}
      </Txt>
      <Txt size={13} weight="600" tone="muted">
        {t("admin.workouts.targetTrainee")}
      </Txt>
      <ChipRow>
        {(trainees.data?.trainees ?? []).map((trainee) => (
          <Chip
            key={trainee.id}
            label={trainee.displayName}
            selected={target === trainee.id}
            onPress={() => setTarget(trainee.id)}
          />
        ))}
      </ChipRow>
      <Txt size={13} weight="600" tone="muted">
        {t("admin.workouts.targetWeek")}
      </Txt>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Pressable hitSlop={10} onPress={() => setTargetWeek(shiftWeek(targetWeek, -1))}>
          <Ionicons name="chevron-back" size={22} color={theme.fg} />
        </Pressable>
        <Txt weight="600">
          {shortDate(targetWeek)} – {shortDate(weekRange(targetWeek).to)}
        </Txt>
        <Pressable hitSlop={10} onPress={() => setTargetWeek(shiftWeek(targetWeek, 1))}>
          <Ionicons name="chevron-forward" size={22} color={theme.fg} />
        </Pressable>
      </View>
      {form.message ? <Banner text={form.message} /> : null}
      <Button label={t("admin.workouts.copyWeek")} loading={busy} onPress={() => void submit()} />
    </FormSheet>
  );
};
