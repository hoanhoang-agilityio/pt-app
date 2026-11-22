import { type Href, useRouter } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from "react-native";

import { Avatar } from "@/components/Avatar";
import { EmptyState, ErrorState, IconButton, Screen, Skeleton, Txt } from "@/components/ui";
import { currentLocale } from "@/i18n";
import { formatListTime } from "@/lib/time";
import { useErrorText } from "@/lib/ui-helpers";
import { space, useTheme } from "@/theme";

import { useAuth } from "../../auth/auth-context";
import { useBubbles, useDmInbox, useGroups, useInbox, useUnread } from "../hooks";

type Row = {
  key: string;
  title: string;
  preview: string;
  time: string;
  unread: number;
  avatarName: string;
  avatarUri: string | null;
  href: string;
  muted?: boolean;
};

const InboxRow = ({ row }: { row: Row }) => {
  const theme = useTheme();
  const router = useRouter();

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push(row.href as string as Href)}
      style={[styles.row, { borderBottomColor: theme.line }]}
    >
      <Avatar name={row.avatarName} uri={row.avatarUri} size={50} />
      <View style={{ flex: 1, gap: 2 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", gap: space.sm }}>
          <Txt weight={row.unread > 0 ? "700" : "600"} numberOfLines={1} style={{ flexShrink: 1 }}>
            {row.title}
          </Txt>
          <Txt tone="muted" size={12}>
            {row.time}
          </Txt>
        </View>
        <View style={{ flexDirection: "row", justifyContent: "space-between", gap: space.sm }}>
          <Txt
            tone={row.unread > 0 ? "default" : "muted"}
            weight={row.unread > 0 ? "600" : "400"}
            size={14}
            numberOfLines={1}
            style={{ flexShrink: 1 }}
          >
            {row.preview}
          </Txt>
          {row.unread > 0 ? (
            <View
              style={[
                styles.badge,
                { backgroundColor: row.muted ? theme.muted : theme.accent },
              ]}
            >
              <Txt size={11} weight="700" style={{ color: theme.accentFg }}>
                {row.unread > 99 ? "99+" : row.unread}
              </Txt>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
};

const RowSkeletons = () => (
  <View style={{ padding: space.lg, gap: space.lg }}>
    {[0, 1, 2, 3, 4].map((i) => (
      <View key={i} style={{ flexDirection: "row", gap: space.md, alignItems: "center" }}>
        <Skeleton width={50} height={50} round />
        <View style={{ gap: 8, flex: 1 }}>
          <Skeleton width="50%" height={12} />
          <Skeleton width="80%" height={10} />
        </View>
      </View>
    ))}
  </View>
);

export const InboxScreen = () => {
  const { t } = useTranslation();
  const theme = useTheme();
  const errorText = useErrorText();
  const router = useRouter();
  const { state } = useAuth();
  const me = state.status === "signedIn" ? state.me : null;
  const isAdmin = me?.actor.kind === "admin";
  const locked = me?.actor.kind === "admin" && me.actor.locked;
  const [tab, setTab] = useState<"chats" | "groups">("chats");
  const inbox = useInbox();
  const bubbles = useBubbles();
  const dm = useDmInbox();
  const groups = useGroups();
  const unread = useUnread();
  const labels = { today: t("time.today"), yesterday: t("time.yesterday") };
  const now = new Date();
  const locale = currentLocale();

  const chatRows: Row[] = [];

  if (isAdmin) {
    for (const item of inbox.data?.conversations ?? []) {
      chatRows.push({
        key: `c${item.conversationId}`,
        title: item.displayName,
        preview:
          (item.lastFromAdmin ? t("chat.you") : "") + (item.preview || t("chat.photoPreview")),
        time: formatListTime(item.lastMessageAt, now, locale, labels),
        unread: item.unread,
        avatarName: item.displayName,
        avatarUri: item.avatarUrl,
        href: `/chat/trainee/${item.userId}`,
      });
    }
    for (const item of inbox.data?.withoutConversation ?? []) {
      chatRows.push({
        key: `n${item.userId}`,
        title: item.userName,
        preview: t("chat.withoutConversation"),
        time: "",
        unread: 0,
        avatarName: item.userName,
        avatarUri: item.avatarUrl,
        href: `/chat/trainee/${item.userId}`,
      });
    }
  } else if (me) {
    const coach = bubbles.data?.bubbles[0];
    const coachUnread =
      unread.data && "coachCount" in unread.data ? unread.data.coachCount : 0;

    chatRows.push({
      key: "coach",
      title: coach?.name ?? t("chat.coach"),
      preview: t("chat.coachEmpty"),
      time: "",
      unread: coachUnread,
      avatarName: coach?.name ?? t("chat.coach"),
      avatarUri: coach?.avatarUrl ?? null,
      href: "/chat/coach",
    });
    for (const item of dm.data?.conversations ?? []) {
      chatRows.push({
        key: `d${item.conversationId}`,
        title: item.name,
        preview: item.preview || t("chat.photoPreview"),
        time: formatListTime(item.lastMessageAt, now, locale, labels),
        unread: item.unread,
        avatarName: item.name,
        avatarUri: item.avatarUrl,
        href: `/chat/dm/${item.conversationId}`,
      });
    }
  }

  const groupRows: Row[] = (groups.data?.groups ?? []).map((group) => {
    const last = group.lastMessage;
    const preview = !last
      ? ""
      : last.preview ||
        (last.media === "photo"
          ? t("chat.photoPreview")
          : last.media === "sticker"
            ? t("chat.stickerPreview")
            : last.kind === "system"
              ? t("chat.group.system.unknown")
              : t("chat.unsent"));

    return {
      key: `g${group.id}`,
      title: group.name,
      preview,
      time: formatListTime(group.lastMessageAt, now, locale, labels),
      unread: group.unread,
      avatarName: group.name,
      avatarUri: group.avatarUrl,
      href: `/chat/group/${group.id}`,
      muted: group.muted,
    };
  });

  const query = tab === "chats" ? (isAdmin ? inbox : dm) : groups;
  const rows = tab === "chats" ? chatRows : groupRows;
  const pending = tab === "chats" ? (isAdmin ? inbox.isPending : false) : groups.isPending;
  const refreshing = query.isRefetching;
  const refresh = () => {
    void inbox.refetch();
    void groups.refetch();
    void dm.refetch();
    void bubbles.refetch();
    void unread.refetch();
  };

  return (
    <Screen>
      <View style={{ paddingHorizontal: space.lg, paddingTop: space.sm }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Txt size={24} weight="700">
            {t("chat.title")}
          </Txt>
          {isAdmin && !locked ? (
            <IconButton
              name="people-outline"
              label={t("groupMgmt.createTitle")}
              onPress={() => router.push("/chat/group-new" as string as Href)}
            />
          ) : null}
        </View>
        <View style={[styles.tabs, { backgroundColor: theme.line }]}>
          {(["chats", "groups"] as const).map((value) => (
            <Pressable
              key={value}
              accessibilityRole="tab"
              accessibilityState={{ selected: tab === value }}
              onPress={() => setTab(value)}
              style={[styles.tab, tab === value && { backgroundColor: theme.surface }]}
            >
              <Txt size={14} weight="600" tone={tab === value ? "default" : "muted"}>
                {t(value === "chats" ? "chat.tabChats" : "chat.tabGroups")}
              </Txt>
            </Pressable>
          ))}
        </View>
      </View>
      {locked ? (
        <EmptyState icon="lock-closed-outline" title={t("auth.adminLocked")} />
      ) : (
        <FlatList
          data={pending ? [] : rows}
          keyExtractor={(row) => row.key}
          renderItem={({ item }) => <InboxRow row={item} />}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
          contentContainerStyle={{ flexGrow: 1 }}
          ListEmptyComponent={
            pending ? (
              <RowSkeletons />
            ) : query.isError ? (
              <ErrorState message={errorText(query.error)} onRetry={refresh} />
            ) : (
              <EmptyState
                title={t(tab === "chats" ? "chat.empty" : "chat.groupsEmpty")}
              />
            )
          }
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
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 5,
    alignItems: "center",
    justifyContent: "center",
  },
  tabs: { flexDirection: "row", borderRadius: 10, padding: 3, marginTop: space.md, marginBottom: space.sm },
  tab: { flex: 1, minHeight: 34, borderRadius: 8, alignItems: "center", justifyContent: "center" },
});
