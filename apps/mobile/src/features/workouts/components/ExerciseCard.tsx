import { Ionicons } from "@expo/vector-icons";
import {
  getYoutubeThumbnailUrl,
  getYoutubeWatchUrl,
  type ScheduleExerciseResponse,
} from "@pt/contracts";
import { Image } from "expo-image";
import { useTranslation } from "react-i18next";
import { Alert, Linking, Pressable, StyleSheet, View } from "react-native";

import { Txt } from "@/components/ui";
import { useErrorText } from "@/lib/ui-helpers";
import { formatVnClock, formatVnShortDate } from "@/lib/week";
import { canLogSets, canShowLoggedSets, formatVolume, getLoggedSetsKey } from "@/lib/workouts-model";
import { radius, space, useTheme } from "@/theme";

import { useSetCompletion } from "../hooks";
import { LoggedSets, SetLogger } from "./SetLogger";

export const ExerciseCard = ({
  exercise,
  index,
  isDue,
}: {
  exercise: ScheduleExerciseResponse;
  index: number;
  // Today or a past day: sets can be logged and the exercise marked done.
  isDue: boolean;
}) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const errorText = useErrorText();
  const completion = useSetCompletion(exercise.id);
  const done = exercise.completedAt !== null;
  const volume = formatVolume(
    exercise.sets ? t("train.sets", { count: exercise.sets }) : null,
    exercise.reps,
  );
  const watchUrl = exercise.youtubeId ? getYoutubeWatchUrl(exercise.youtubeId) : null;
  const openVideo = () => {
    if (watchUrl) {
      void Linking.openURL(watchUrl).catch(() => Alert.alert(t("common.errorGeneric")));
    }
  };

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: theme.surface, borderColor: done ? theme.success : theme.line },
      ]}
    >
      {exercise.youtubeId ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("train.playVideo", { title: exercise.title })}
          onPress={openVideo}
          style={styles.video}
        >
          <Image
            source={{ uri: getYoutubeThumbnailUrl(exercise.youtubeId) }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={120}
          />
          <View style={styles.shade} />
          <View style={styles.play}>
            <Ionicons name="play" size={26} color="#000" />
          </View>
          <View style={styles.number}>
            <Txt size={13} weight="700" style={{ color: "#fff" }}>
              {index + 1}
            </Txt>
          </View>
          {done && exercise.completedAt ? (
            <View style={[styles.doneBadge, { backgroundColor: theme.success }]}>
              <Txt size={12} weight="700" style={{ color: "#fff" }}>
                {t("train.completedAt", {
                  time: formatVnClock(exercise.completedAt),
                  date: formatVnShortDate(exercise.completedAt),
                })}
              </Txt>
            </View>
          ) : null}
        </Pressable>
      ) : null}
      <View style={{ padding: space.lg, gap: space.sm }}>
        <Txt size={17} weight="600">
          {exercise.title}
        </Txt>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
          {volume ? (
            <View style={[styles.pill, { backgroundColor: theme.line }]}>
              <Txt size={13} weight="600" tone="accent">
                {volume}
              </Txt>
            </View>
          ) : null}
          {exercise.isPersonalBest ? (
            <View style={[styles.pill, { backgroundColor: theme.accent }]}>
              <Txt size={13} weight="600" style={{ color: theme.accentFg }}>
                {t("train.personalBest")}
              </Txt>
            </View>
          ) : null}
        </View>
        {exercise.description ? (
          <Txt tone="muted" size={14}>
            {exercise.description}
          </Txt>
        ) : null}
        {watchUrl ? (
          <Pressable accessibilityRole="link" onPress={openVideo} hitSlop={8}>
            <Txt size={13} tone="muted">
              {t("train.openYoutube")} ↗
            </Txt>
          </Pressable>
        ) : null}
        {exercise.timed ? (
          <Txt size={12} tone="muted">
            {t("train.timedHint")}
          </Txt>
        ) : null}
      </View>
      {canLogSets(exercise, isDue) ? (
        <SetLogger key={getLoggedSetsKey(exercise.loggedSets)} exercise={exercise} />
      ) : null}
      {canShowLoggedSets(exercise, exercise.loggedSets.length) ? (
        <LoggedSets sets={exercise.loggedSets} />
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: !isDue, busy: completion.isPending, checked: done }}
        disabled={!isDue || completion.isPending}
        onPress={() =>
          completion.mutate(!done, { onError: (error) => Alert.alert(errorText(error)) })
        }
        style={[
          styles.toggle,
          {
            borderColor: done ? theme.success : theme.line,
            backgroundColor: done ? `${theme.success}1f` : "transparent",
            opacity: !isDue ? 0.55 : 1,
          },
        ]}
      >
        <Ionicons
          name={done ? "checkmark-circle" : isDue ? "ellipse-outline" : "calendar-outline"}
          size={22}
          color={done ? theme.success : theme.muted}
        />
        <Txt weight="600" style={{ color: done ? theme.success : theme.fg }}>
          {done && exercise.completedAt
            ? `${t("train.completion.done", { time: formatVnClock(exercise.completedAt) })} ${t("train.completion.undo")}`
            : isDue
              ? t("train.completion.mark")
              : t("train.completion.notDue")}
        </Txt>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth * 2, overflow: "hidden" },
  video: { aspectRatio: 16 / 9, backgroundColor: "#000", alignItems: "center", justifyContent: "center" },
  shade: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(0,0,0,0.25)" },
  play: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(255,255,255,0.95)",
    alignItems: "center",
    justifyContent: "center",
    paddingLeft: 3,
  },
  number: {
    position: "absolute",
    top: space.md,
    left: space.md,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(0,0,0,0.7)",
    alignItems: "center",
    justifyContent: "center",
  },
  doneBadge: {
    position: "absolute",
    top: space.md,
    right: space.md,
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    paddingVertical: 4,
  },
  pill: { borderRadius: radius.pill, paddingHorizontal: space.md, paddingVertical: 4 },
  toggle: {
    minHeight: 54,
    borderTopWidth: StyleSheet.hairlineWidth * 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.sm,
  },
});
