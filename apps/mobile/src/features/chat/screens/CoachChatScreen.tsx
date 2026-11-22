import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { useAuth } from "@/features/auth/auth-context";
import { useTheme } from "@/theme";

import { coachApi,type CoachMeta } from "../api";
import { ConversationView } from "../components/ConversationView";
import { useThread } from "../use-thread";
import { useTyping } from "../use-typing";

// Trainee side of the coach chat (GET /v1/chat/conversations/me).
export const CoachChatScreen = () => {
  const { t } = useTranslation();
  const theme = useTheme();
  const { state } = useAuth();
  const myId = state.status === "signedIn" ? state.me.actor.id : 0;
  const { load, chat } = useMemo(() => coachApi({ kind: "trainee" }, null, null), []);
  const thread = useThread<CoachMeta>({
    target: { kind: "coach", conversationId: null },
    load,
    onRead: (id) => {
      void chat.markRead(id).catch(() => undefined);
    },
  });
  const meta = thread.meta;
  const typing = useTyping({
    conversationId: meta?.conversationId ?? null,
    myRole: "user",
    myKey: `user:${myId}`,
  });
  const name = meta?.latestPtName ?? t("chat.coach");

  return (
    <ConversationView
      title={name}
      avatarName={name}
      thread={thread as never}
      chat={chat}
      color={{ bg: theme.accent, fg: theme.accentFg }}
      seenMode="peer"
      peerTyping={typing.peerTyping}
      onTyping={typing.onTyping}
      banner={meta && !meta.chatEnabled ? t("chat.coachLocked") : null}
    />
  );
};
