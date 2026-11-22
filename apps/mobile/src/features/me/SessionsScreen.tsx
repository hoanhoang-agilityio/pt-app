import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { useTranslation } from "react-i18next";
import { Alert, FlatList, Pressable, RefreshControl, StyleSheet, View } from "react-native";

import { EmptyState, ErrorState, Screen, Skeleton, Txt } from "@/components/ui";
import { currentLocale } from "@/i18n";
import { qk } from "@/lib/query-keys";
import { formatAge } from "@/lib/time";
import { confirmAction, useErrorText } from "@/lib/ui-helpers";
import { space, useTheme } from "@/theme";

import { fetchSessions, revokeSession } from "../auth/api";

export const SessionsScreen = () => {
  const { t } = useTranslation();
  const theme = useTheme();
  const errorText = useErrorText();
  const queryClient = useQueryClient();
  const sessions = useQuery({ queryKey: qk.sessions, queryFn: fetchSessions });
  const revoke = useMutation({
    mutationFn: revokeSession,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.sessions }),
    onError: (error) => Alert.alert(errorText(error)),
  });
  const labels = {
    now: t("time.now"),
    minutes: t("time.minutes"),
    hours: t("time.hours"),
    days: t("time.days"),
  };
  const now = new Date();
  const clientLabel = (kind: string) =>
    kind === "ios" || kind === "android" || kind === "web" ? t(`me.client.${kind}`) : kind;

  return (
    <Screen edges={["bottom"]}>
      <Stack.Screen options={{ title: t("me.devices"), headerShown: true }} />
      {sessions.isPending ? (
        <View style={{ padding: space.lg, gap: space.lg }}>
          <Skeleton width="60%" height={14} />
          <Skeleton width="40%" height={12} />
        </View>
      ) : sessions.isError ? (
        <ErrorState message={errorText(sessions.error)} onRetry={() => void sessions.refetch()} />
      ) : (
        <FlatList
          data={sessions.data.sessions}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl
              refreshing={sessions.isRefetching}
              onRefresh={() => void sessions.refetch()}
            />
          }
          ListEmptyComponent={<EmptyState icon="phone-portrait-outline" title={t("me.devicesEmpty")} />}
          renderItem={({ item }) => (
            <View style={[styles.row, { borderBottomColor: theme.line }]}>
              <Ionicons
                name={item.clientKind === "web" ? "globe-outline" : "phone-portrait-outline"}
                size={24}
                color={theme.accent}
              />
              <View style={{ flex: 1, gap: 2 }}>
                <Txt weight="600">
                  {item.clientName ?? clientLabel(item.clientKind)}
                  {item.current ? ` · ${t("me.thisDevice")}` : ""}
                </Txt>
                <Txt tone="muted" size={13}>
                  {t("me.lastSeen", {
                    when: formatAge(item.lastSeenAt, now, currentLocale(), labels),
                  })}
                </Txt>
              </View>
              {item.current ? null : (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t("me.signOutDevice")}
                  hitSlop={8}
                  onPress={() =>
                    confirmAction({
                      title: t("me.signOutDeviceConfirm"),
                      confirmLabel: t("me.signOutDevice"),
                      cancelLabel: t("common.cancel"),
                      destructive: true,
                      onConfirm: () => revoke.mutate(item.id),
                    })
                  }
                >
                  <Ionicons name="log-out-outline" size={22} color={theme.danger} />
                </Pressable>
              )}
            </View>
          )}
        />
      )}
    </Screen>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    padding: space.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
