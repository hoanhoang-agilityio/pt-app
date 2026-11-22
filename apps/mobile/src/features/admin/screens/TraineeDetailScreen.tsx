import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type Href, useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Switch, View } from "react-native";

import { Avatar } from "@/components/Avatar";
import { Button, Txt } from "@/components/ui";
import { currentLocale } from "@/i18n";
import { formatDate } from "@/lib/time";
import { confirmAction, useErrorText } from "@/lib/ui-helpers";
import { space, useTheme } from "@/theme";

import {
  assignTraineePt,
  changeTraineeEmail,
  deleteTrainee,
  fetchTrainee,
  hideUsers,
  resetTraineePassword,
  setChatEnabled,
} from "../api";
import { Banner, Card, Chip, ChipRow, Field, FormSheet, ListRow, Loaded, Page, SectionTitle, useFormError } from "../components/kit";
import { OneTimePassword } from "../components/OneTimePassword";
import { ak } from "../keys";
import { useIsSuperAdmin, usePts } from "../use-admin";

export const useTraineeId = () => {
  const params = useLocalSearchParams<{ userId: string }>();

  return Number(params.userId);
};

export const TraineeDetailScreen = () => {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const errorText = useErrorText();
  const isSuper = useIsSuperAdmin();
  const pts = usePts();
  const userId = useTraineeId();
  const query = useQuery({
    queryKey: ak.trainee(userId),
    queryFn: () => fetchTrainee(userId),
    enabled: Number.isInteger(userId) && userId > 0,
  });
  const [sheet, setSheet] = useState<"email" | "pt" | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState<string | null>(null);
  const emailForm = useFormError();
  const open = (path: string) => router.push(path as string as Href);
  const refresh = () => queryClient.invalidateQueries({ queryKey: ak.trainee(userId) });
  const onError = (error: unknown) => Alert.alert(errorText(error));

  const toggleChat = useMutation({
    mutationFn: (enabled: boolean) => setChatEnabled(userId, enabled),
    onSuccess: refresh,
    onError,
  });
  const saveEmail = useMutation({
    mutationFn: () => changeTraineeEmail(userId, email),
    onSuccess: () => {
      setSheet(null);
      void refresh();
    },
    onError: emailForm.setError,
  });
  const reset = useMutation({
    mutationFn: () => resetTraineePassword(userId),
    onSuccess: (result) => setPassword(result.password),
    onError,
  });
  const assign = useMutation({
    mutationFn: (ptAdminId: number | null) => assignTraineePt(userId, ptAdminId),
    onSuccess: () => {
      setSheet(null);
      void queryClient.invalidateQueries({ queryKey: ak.all });
    },
    onError,
  });
  const hide = useMutation({
    mutationFn: () => hideUsers([userId]),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ak.all });
      router.back();
    },
    onError,
  });
  const remove = useMutation({
    mutationFn: () => deleteTrainee(userId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ak.all });
      router.back();
    },
    onError,
  });

  const confirm = (key: string, run: () => void, destructive = false) =>
    confirmAction({
      title: t(`admin.trainee.${key}Title`),
      message: t(`admin.trainee.${key}Body`),
      confirmLabel: t(`admin.trainee.${key}Confirm`),
      cancelLabel: t("common.cancel"),
      destructive,
      onConfirm: run,
    });

  return (
    <Page
      title={t("admin.trainee.title")}
      onRefresh={() => void query.refetch()}
      refreshing={query.isRefetching}
    >
      <Loaded query={query}>
        {(trainee) => (
          <>
            <Card gap={space.md}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: space.md }}>
                <Avatar name={trainee.displayName} uri={trainee.avatarUrl} size={64} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Txt size={19} weight="700">
                    {trainee.displayName}
                  </Txt>
                  {trainee.displayName !== trainee.name ? (
                    <Txt tone="muted" size={13}>
                      {trainee.name}
                    </Txt>
                  ) : null}
                  <Txt tone="muted" size={13} selectable>
                    {trainee.email ?? t("admin.trainee.noLogin")}
                  </Txt>
                  <Txt tone="muted" size={12}>
                    {t("admin.trainee.since", {
                      date: formatDate(new Date(trainee.createdAt), currentLocale()),
                    })}
                  </Txt>
                </View>
              </View>
            </Card>

            <SectionTitle>{t("admin.trainee.plan")}</SectionTitle>
            <View>
              <ListRow
                title={t("admin.trainee.workouts")}
                left={<Ionicons name="barbell-outline" size={22} color={theme.accent} />}
                onPress={() => open(`/admin/trainee/${userId}/workouts`)}
              />
              <ListRow
                title={t("admin.trainee.nutrition")}
                left={<Ionicons name="nutrition-outline" size={22} color={theme.accent} />}
                onPress={() => open(`/admin/trainee/${userId}/nutrition`)}
              />
              <ListRow
                title={t("admin.trainee.mealPlan")}
                left={<Ionicons name="restaurant-outline" size={22} color={theme.accent} />}
                onPress={() => open(`/admin/trainee/${userId}/meal-plan`)}
              />
              <ListRow
                title={t("admin.trainee.progress")}
                left={<Ionicons name="stats-chart-outline" size={22} color={theme.accent} />}
                onPress={() => open(`/admin/trainee/${userId}/progress`)}
              />
              <ListRow
                title={t("admin.trainee.chat")}
                left={<Ionicons name="chatbubble-ellipses-outline" size={22} color={theme.accent} />}
                onPress={() => open(`/chat/trainee/${userId}`)}
              />
              {isSuper ? (
                <ListRow
                  title={t("admin.trainee.restriction")}
                  left={<Ionicons name="shield-outline" size={22} color={theme.accent} />}
                  onPress={() => open(`/admin/trainee/${userId}/restriction`)}
                />
              ) : null}
            </View>

            <SectionTitle>{t("admin.trainee.settings")}</SectionTitle>
            <ListRow
              title={t("admin.trainee.chatEnabled")}
              subtitle={t("admin.trainee.chatEnabledHint")}
              right={
                <Switch
                  value={trainee.chatEnabled}
                  disabled={toggleChat.isPending}
                  onValueChange={(value) => toggleChat.mutate(value)}
                  trackColor={{ true: theme.accent }}
                />
              }
            />
            <ListRow
              title={t("admin.trainee.changeEmail")}
              subtitle={trainee.email ?? t("admin.trainee.noLogin")}
              onPress={() => {
                setEmail(trainee.email ?? "");
                emailForm.clear();
                setSheet("email");
              }}
            />
            <ListRow
              title={t("admin.trainee.resetPassword")}
              subtitle={trainee.hasLogin ? undefined : t("admin.trainee.needEmail")}
              onPress={
                trainee.hasLogin
                  ? () => confirm("reset", () => reset.mutate())
                  : () => Alert.alert(t("admin.trainee.needEmail"))
              }
            />
            {isSuper ? (
              <ListRow
                title={t("admin.trainee.assignPt")}
                subtitle={
                  trainee.ptAdminId === null
                    ? t("admin.members.noPt")
                    : (pts.data?.accounts.find((a) => a.id === trainee.ptAdminId)?.username ?? "")
                }
                onPress={() => setSheet("pt")}
              />
            ) : null}
            {!trainee.hidden ? (
              <ListRow
                title={t("admin.trainee.hide")}
                subtitle={t("admin.trainee.hideHint")}
                onPress={() => confirm("hide", () => hide.mutate())}
              />
            ) : (
              <Banner tone="info" text={t("admin.trainee.hiddenNote")} />
            )}
            <ListRow
              danger
              title={t("admin.trainee.delete")}
              onPress={() => confirm("delete", () => remove.mutate(), true)}
            />

            <FormSheet
              visible={sheet === "email"}
              title={t("admin.trainee.changeEmail")}
              onClose={() => setSheet(null)}
            >
              <Field
                label={t("admin.members.email")}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                error={emailForm.fieldError("email")}
              />
              {emailForm.message && !emailForm.hasFields ? <Banner text={emailForm.message} /> : null}
              <Button
                label={t("common.save")}
                loading={saveEmail.isPending}
                disabled={email.trim() === ""}
                onPress={() => {
                  emailForm.clear();
                  saveEmail.mutate();
                }}
              />
            </FormSheet>

            <FormSheet
              visible={sheet === "pt"}
              title={t("admin.trainee.assignPt")}
              onClose={() => setSheet(null)}
            >
              <ChipRow>
                <Chip
                  label={t("admin.members.noPt")}
                  selected={trainee.ptAdminId === null}
                  onPress={() => assign.mutate(null)}
                />
                {pts.data?.accounts.map((account) => (
                  <Chip
                    key={account.id}
                    label={account.username}
                    selected={trainee.ptAdminId === account.id}
                    onPress={() => assign.mutate(account.id)}
                  />
                ))}
              </ChipRow>
            </FormSheet>
          </>
        )}
      </Loaded>
      <OneTimePassword
        visible={password !== null}
        title={t("admin.trainee.newPassword")}
        password={password ?? ""}
        onClose={() => setPassword(null)}
      />
    </Page>
  );
};
