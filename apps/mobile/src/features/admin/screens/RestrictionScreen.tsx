import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert } from "react-native";

import { Button, Txt } from "@/components/ui";
import { currentLocale } from "@/i18n";
import { formatDate } from "@/lib/time";
import { confirmAction, useErrorText } from "@/lib/ui-helpers";

import { fetchRestriction, liftRestriction, saveRestriction } from "../api";
import { Banner, Card, Chip, ChipRow, Field, Loaded, Page, Pill, SectionTitle, useFormError } from "../components/kit";
import { ak } from "../keys";
import { useIsSuperAdmin } from "../use-admin";
import { useTraineeId } from "./TraineeDetailScreen";

const LEVELS = ["restricted", "suspended"] as const;
const DURATIONS = ["24h", "7d", "30d", "permanent"] as const;

// Super admin only: block a trainee (restricted or suspended) or lift it.
export const RestrictionScreen = () => {
  const { t } = useTranslation();
  const userId = useTraineeId();
  const isSuper = useIsSuperAdmin();
  const queryClient = useQueryClient();
  const errorText = useErrorText();
  const form = useFormError();
  const query = useQuery({
    queryKey: ak.restriction(userId),
    queryFn: () => fetchRestriction(userId),
    enabled: isSuper,
  });
  const [level, setLevel] = useState<(typeof LEVELS)[number]>("restricted");
  const [duration, setDuration] = useState<(typeof DURATIONS)[number]>("7d");
  const [reason, setReason] = useState("");
  const done = () => {
    void queryClient.invalidateQueries({ queryKey: ak.restriction(userId) });
    void queryClient.invalidateQueries({ queryKey: ak.all });
  };
  const save = useMutation({
    mutationFn: () => saveRestriction(userId, { level, duration, reason }),
    onSuccess: () => {
      setReason("");
      done();
    },
    onError: form.setError,
  });
  const lift = useMutation({
    mutationFn: () => liftRestriction(userId),
    onSuccess: done,
    onError: (error) => Alert.alert(errorText(error)),
  });
  const locale = currentLocale();

  if (!isSuper) {
    return (
      <Page title={t("admin.trainee.restriction")}>
        <Banner text={t("admin.forbidden")} />
      </Page>
    );
  }
  return (
    <Page title={t("admin.trainee.restriction")} onRefresh={() => void query.refetch()} refreshing={query.isRefetching}>
      <Loaded query={query}>
        {(data) => (
          <>
            {data.restriction ? (
              <Card gap={8}>
                <Pill label={t(`admin.restriction.level.${data.restriction.level}`)} tone="danger" />
                <Txt>{data.restriction.reason}</Txt>
                <Txt size={13} tone="muted">
                  {data.restriction.until
                    ? t("admin.restriction.until", { date: formatDate(new Date(data.restriction.until), locale) })
                    : t("admin.restriction.permanent")}
                </Txt>
                <Button
                  label={t("admin.restriction.lift")}
                  variant="secondary"
                  loading={lift.isPending}
                  onPress={() =>
                    confirmAction({
                      title: t("admin.restriction.liftTitle"),
                      confirmLabel: t("admin.restriction.lift"),
                      cancelLabel: t("common.cancel"),
                      onConfirm: () => lift.mutate(),
                    })
                  }
                />
              </Card>
            ) : (
              <Txt tone="muted">{t("admin.restriction.none")}</Txt>
            )}

            <SectionTitle>{data.restriction ? t("admin.restriction.replace") : t("admin.restriction.block")}</SectionTitle>
            <Txt size={13} weight="600" tone="muted">
              {t("admin.restriction.levelLabel")}
            </Txt>
            <ChipRow>
              {LEVELS.map((value) => (
                <Chip key={value} label={t(`admin.restriction.level.${value}`)} selected={level === value} onPress={() => setLevel(value)} />
              ))}
            </ChipRow>
            <Txt size={12} tone="muted">
              {t(`admin.restriction.levelHint.${level}`)}
            </Txt>
            <Txt size={13} weight="600" tone="muted">
              {t("admin.restriction.durationLabel")}
            </Txt>
            <ChipRow>
              {DURATIONS.map((value) => (
                <Chip key={value} label={t(`admin.restriction.duration.${value}`)} selected={duration === value} onPress={() => setDuration(value)} />
              ))}
            </ChipRow>
            <Field
              label={t("admin.restriction.reason")}
              value={reason}
              onChangeText={setReason}
              multiline
              maxLength={300}
              error={form.fieldError("reason")}
            />
            {form.message && !form.hasFields ? <Banner text={form.message} /> : null}
            <Button
              label={t("admin.restriction.apply")}
              variant="danger"
              loading={save.isPending}
              disabled={reason.trim() === ""}
              onPress={() => {
                form.clear();
                save.mutate();
              }}
            />

            {data.history.length > 0 ? (
              <>
                <SectionTitle>{t("admin.restriction.history")}</SectionTitle>
                {data.history.map((item) => (
                  <Card key={item.id} gap={4}>
                    <Txt weight="600">
                      {t(`admin.restriction.level.${item.level}`)} · {formatDate(new Date(item.createdAt), locale)}
                    </Txt>
                    <Txt size={14}>{item.reason}</Txt>
                    <Txt size={12} tone="muted">
                      {item.createdBy ?? ""}
                      {item.liftedAt ? ` · ${t("admin.restriction.lifted", { date: formatDate(new Date(item.liftedAt), locale) })}` : ""}
                    </Txt>
                  </Card>
                ))}
              </>
            ) : null}
          </>
        )}
      </Loaded>
    </Page>
  );
};
