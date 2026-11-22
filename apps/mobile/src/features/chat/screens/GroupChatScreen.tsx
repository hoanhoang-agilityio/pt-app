import { useLocalSearchParams } from "expo-router";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { useAuth } from "@/features/auth/auth-context";
import { useTheme } from "@/theme";

import { groupApi, type GroupMeta } from "../api";
import { ConversationView } from "../components/ConversationView";
import { useThread } from "../use-thread";

export const GroupChatScreen = () => {
  const { t } = useTranslation();
  const theme = useTheme();
  const params = useLocalSearchParams<{ id: string }>();
  const groupId = Number(params.id);
  const { state } = useAuth();
  const actor = state.status === "signedIn" ? state.me.actor : null;
  const viewerKey = actor ? `${actor.kind === "admin" ? "admin" : "user"}:${actor.id}` : "";
  const { load, chat } = useMemo(() => groupApi(groupId, viewerKey), [groupId, viewerKey]);
  const thread = useThread<GroupMeta>({
    target: { kind: "group", groupId },
    load,
    onRead: (id) => {
      void chat.markRead(id).catch(() => undefined);
    },
  });
  const meta = thread.meta;
  const banner = !meta
    ? null
    : meta.dissolved
      ? t("chat.group.dissolved")
      : meta.sendBlock !== null
        ? meta.managersOnly
          ? t("chat.group.managersOnly")
          : t("chat.group.notMember")
        : null;

  return (
    <ConversationView
      title={meta?.name ?? ""}
      avatarName={meta?.name ?? ""}
      avatarUri={meta?.avatarUrl ?? null}
      thread={thread as never}
      chat={chat}
      color={{ bg: theme.accent, fg: theme.accentFg }}
      showSender
      seenMode="none"
      banner={banner}
    />
  );
};
