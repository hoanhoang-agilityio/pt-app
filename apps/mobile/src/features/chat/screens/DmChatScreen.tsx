import { useLocalSearchParams } from "expo-router";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { useAuth } from "@/features/auth/auth-context";
import { useTheme } from "@/theme";

import { dmApi } from "../api";
import { ConversationView } from "../components/ConversationView";
import { useDmInbox } from "../hooks";
import { useThread } from "../use-thread";

// Trainee to trainee chat is read-only by the API (403 DM_DISABLED): the
// composer is replaced by a notice; a member can still take back own messages.
export const DmChatScreen = () => {
  const { t } = useTranslation();
  const theme = useTheme();
  const params = useLocalSearchParams<{ cid: string }>();
  const conversationId = Number(params.cid);
  const { state } = useAuth();
  const myId = state.status === "signedIn" ? state.me.actor.id : 0;
  const isSuperAdmin =
    state.status === "signedIn" && state.me.actor.kind === "admin" && state.me.actor.role === "super_admin";
  const inbox = useDmInbox();
  const entry = inbox.data?.conversations.find((c) => c.conversationId === conversationId);
  const { load, markRead, chat } = useMemo(() => dmApi(conversationId, myId), [conversationId, myId]);
  const thread = useThread<{ readOnly: boolean }>({
    target: { kind: "dm", conversationId },
    load,
    onRead: () => {
      void markRead().catch(() => undefined);
    },
  });

  return (
    <ConversationView
      title={entry?.name ?? t("chat.dmSection")}
      avatarName={entry?.name ?? ""}
      avatarUri={entry?.avatarUrl ?? null}
      thread={thread as never}
      chat={chat}
      scope={{ kind: "dm" }}
      reactions={false}
      isSuperAdmin={isSuperAdmin}
      color={{ bg: theme.accent, fg: theme.accentFg }}
      showSender
      seenMode="peer"
      banner={t("chat.dmReadOnly")}
    />
  );
};
