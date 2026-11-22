import type { SocialNotificationPageResponse } from "@pt/contracts";
import { useQueryClient } from "@tanstack/react-query";
import { type Href, Stack, useRouter } from "expo-router";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from "react-native";

import { Avatar } from "@/components/Avatar";
import { EmptyState, ErrorState, Screen, Skeleton, Txt } from "@/components/ui";
import { currentLocale } from "@/i18n";
import { qk } from "@/lib/query-keys";
import { formatAge } from "@/lib/time";
import { useErrorText } from "@/lib/ui-helpers";
import { space, useTheme } from "@/theme";

import { markNotificationsRead } from "./api";
import { useNotifications } from "./hooks";

type Item = SocialNotificationPageResponse["items"][number];

// Social notifications; opening the list marks them read (like the web).
export const NotificationsScreen = () => {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const errorText = useErrorText();
  const query = useNotifications();
  const marked = useRef(false);

  useEffect(() => {
    if (query.data && query.unreadCount > 0 && !marked.current) {
      marked.current = true;
      void markNotificationsRead().then(() => {
        void queryClient.invalidateQueries({ queryKey: qk.socialMe });
        void queryClient.invalidateQueries({ queryKey: qk.notifications });
      });
    }
  }, [query.data, query.unreadCount, queryClient]);

  const open = (item: Item) => {
    if (item.postId !== null) {
      router.push(`/post/${item.postId}` as string as Href);
    } else {
      router.push(`/profile/${encodeURIComponent(item.actorKey)}` as string as Href);
    }
  };

  return (
    <Screen edges={["bottom"]}>
      <Stack.Screen options={{ title: t("notifications.title") }} />
      <FlatList
        data={query.isPending ? [] : query.items}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={{ flexGrow: 1 }}
        refreshControl={
          <RefreshControl refreshing={query.isRefetching} onRefresh={() => void query.refetch()} />
        }
        onEndReached={() => {
          if (query.hasNextPage && !query.isFetchingNextPage) {
            void query.fetchNextPage();
          }
        }}
        ListEmptyComponent={
          query.isPending ? (
            <View style={{ padding: space.lg, gap: space.lg }}>
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} height={48} />
              ))}
            </View>
          ) : query.isError ? (
            <ErrorState message={errorText(query.error)} onRetry={() => void query.refetch()} />
          ) : (
            <EmptyState icon="notifications-outline" title={t("notifications.empty")} />
          )
        }
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            onPress={() => open(item)}
            style={[
              styles.row,
              { backgroundColor: item.isUnread ? theme.surface : "transparent", borderBottomColor: theme.line },
            ]}
          >
            <Avatar name={item.actorName} uri={item.actorAvatarUrl} size={44} />
            <View style={{ flex: 1 }}>
              <Txt>{t(`notifications.${item.kind}`, { name: item.actorName })}</Txt>
              <Txt tone="muted" size={12}>
                {formatAge(item.createdAt, new Date(), currentLocale(), {
                  now: t("time.now"),
                  minutes: t("time.minutes"),
                  hours: t("time.hours"),
                  days: t("time.days"),
                })}
              </Txt>
            </View>
            {item.isUnread ? (
              <View style={[styles.dot, { backgroundColor: theme.accent }]} />
            ) : null}
          </Pressable>
        )}
      />
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
  dot: { width: 10, height: 10, borderRadius: 5 },
});
