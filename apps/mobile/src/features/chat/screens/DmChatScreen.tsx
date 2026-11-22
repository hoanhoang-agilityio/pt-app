import { useLocalSearchParams } from "expo-router";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { useAuth } from "@/features/auth/auth-context";
import { useTheme } from "@/theme";

import { dmApi } from "../api";
import { ConversationView } from "../components/ConversationView";
import { useDmInbox } from "../hooks";
import { useThread } from "../use-thread";

// Trainee to trainee conversations are read-only: no composer.
export const DmChatScreen = () => {
  const { t } = useTranslation();
  const theme = useTheme();
  const params = useLocalSearchParams<{ cid: string }>();
  const conversationId = Number(params.cid);
  const { state } = useAuth();
  const myId = state.status === "signedIn" ? state.me.actor.id : 0;
  const inbox = useDmInbox();
  const entry = inbox.data?.conversations.find((c) => c.conversationId === conversationId);
  const { load, markRead } = useMemo(() => dmApi(conversationId, myId), [conversationId, myId]);
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
      chat={null}
      color={{ bg: theme.accent, fg: theme.accentFg }}
      showSender
      seenMode="peer"
      banner={t("chat.dmReadOnly")}
    />
  );
};
