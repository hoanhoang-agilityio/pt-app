import type { SocialReportResolution } from "@pt/contracts";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { type Href, Stack, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { Alert, FlatList, RefreshControl, StyleSheet, View } from "react-native";

import { Button, EmptyState, ErrorState, Screen, Spinner, Txt } from "@/components/ui";
import { currentLocale } from "@/i18n";
import { qk } from "@/lib/query-keys";
import { formatAge } from "@/lib/time";
import { confirmAction, useErrorText } from "@/lib/ui-helpers";
import { radius, space, useTheme } from "@/theme";

import { resolveReport } from "./api";
import { useIsSuperAdmin, useReports } from "./hooks";

// The open reports queue (super admin): keep, delete (post or comment) or hide
// (chat message).
export const ReportsScreen = () => {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const errorText = useErrorText();
  const queryClient = useQueryClient();
  const allowed = useIsSuperAdmin();
  const reports = useReports();
  const resolve = useMutation({
    mutationFn: ({ id, resolution }: { id: number; resolution: SocialReportResolution }) =>
      resolveReport(id, resolution),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.reports }),
    onError: (error) => Alert.alert(errorText(error)),
  });

  const act = (id: number, resolution: SocialReportResolution) =>
    confirmAction({
      title: t(`reportsQueue.confirm.${resolution}`),
      confirmLabel: t(`reportsQueue.actions.${resolution}`),
      cancelLabel: t("common.cancel"),
      destructive: resolution !== "kept",
      onConfirm: () => resolve.mutate({ id, resolution }),
    });

  return (
    <Screen edges={["bottom"]}>
      <Stack.Screen options={{ title: t("reportsQueue.title") }} />
      {!allowed ? (
        <EmptyState icon="shield-outline" title={t("reportsQueue.forbidden")} />
      ) : reports.isPending ? (
        <Spinner />
      ) : reports.isError ? (
        <ErrorState message={errorText(reports.error)} onRetry={() => void reports.refetch()} />
      ) : (
        <FlatList
          data={reports.data.items}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{ padding: space.lg, gap: space.md, flexGrow: 1 }}
          refreshControl={
            <RefreshControl refreshing={reports.isRefetching} onRefresh={() => void reports.refetch()} />
          }
          ListEmptyComponent={<EmptyState icon="shield-checkmark-outline" title={t("reportsQueue.empty")} />}
          renderItem={({ item }) => {
            const isMessage = item.targetKind === "message" || item.targetKind === "group_message";
            const canDelete = item.targetKind === "post" || item.targetKind === "comment";

            return (
              <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.line }]}>
                <Txt weight="600">
                  {t(`reportsQueue.kinds.${item.targetKind}`)}
                  {item.targetName ? ` · ${item.targetName}` : ""}
                </Txt>
                <Txt tone="muted" size={12}>
                  {t("reportsQueue.by", { name: item.reporterName })} ·{" "}
                  {formatAge(item.createdAt, new Date(), currentLocale(), {
                    now: t("time.now"),
                    minutes: t("time.minutes"),
                    hours: t("time.hours"),
                    days: t("time.days"),
                  })}
                </Txt>
                {item.reasonCode ? <Txt size={13}>{t(`report.reasons.${item.reasonCode}`)}</Txt> : null}
                {item.reason ? <Txt size={13}>{item.reason}</Txt> : null}
                {item.group ? (
                  <Txt tone="muted" size={12}>
                    {t("reportsQueue.inGroup", { name: item.group.name })}
                  </Txt>
                ) : null}
                <Txt style={[styles.preview, { borderLeftColor: theme.accent }]} tone={item.preview ? "default" : "muted"}>
                  {item.preview ?? t("reportsQueue.gone")}
                </Txt>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
                  {item.postId !== null ? (
                    <Button
                      label={t("reportsQueue.openPost")}
                      variant="ghost"
                      onPress={() => router.push(`/post/${item.postId}` as string as Href)}
                    />
                  ) : null}
                  <Button
                    label={t("reportsQueue.actions.kept")}
                    variant="secondary"
                    disabled={resolve.isPending}
                    onPress={() => act(item.id, "kept")}
                  />
                  {canDelete ? (
                    <Button
                      label={t("reportsQueue.actions.deleted")}
                      variant="danger"
                      disabled={resolve.isPending}
                      onPress={() => act(item.id, "deleted")}
                    />
                  ) : null}
                  {isMessage && item.message ? (
                    <Button
                      label={t("reportsQueue.actions.hidden")}
                      variant="danger"
                      disabled={resolve.isPending}
                      onPress={() => act(item.id, "hidden")}
                    />
                  ) : null}
                </View>
              </View>
            );
          }}
        />
      )}
    </Screen>
  );
};

const styles = StyleSheet.create({
  card: { padding: space.lg, gap: space.sm, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth },
  preview: { borderLeftWidth: 3, paddingLeft: space.sm, marginVertical: space.xs },
});
