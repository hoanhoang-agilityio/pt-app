import { chatAdminLabel } from "@pt/contracts";
import { type Href, useRouter } from "expo-router";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { useAuth } from "@/features/auth/auth-context";
import { useTheme } from "@/theme";

import { coachApi, type CoachMeta } from "../api";
import { ConversationView } from "../components/ConversationView";
import { usePeerPresence } from "../presence";
import { useRefreshOnFocus } from "../use-refresh-on-focus";
import { useThread } from "../use-thread";
import { useTyping } from "../use-typing";

// Trainee side of the coach chat (GET /v1/chat/conversations/me).
export const CoachChatScreen = () => {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const { state } = useAuth();
  const myId = state.status === "signedIn" ? state.me.actor.id : 0;
  const { load, chat } = useMemo(
    () => coachApi({ kind: "trainee" }, null, null),
    [],
  );
  const thread = useThread<CoachMeta>({
    target: { kind: "coach", conversationId: null },
    load,
    onRead: (id) => chat.markRead(id),
  });
  const meta = thread.meta;
  const typing = useTyping({
    conversationId: meta?.conversationId ?? null,
    myRole: "user",
    myKey: `user:${myId}`,
  });
  const real = meta?.latestPtName ?? t("chat.coach");
  const name = chatAdminLabel(
    meta?.profile.nicknames,
    meta?.latestPtId ?? null,
    real,
    true,
  );
  const presence = usePeerPresence(null, meta !== null);

  useRefreshOnFocus(() => void thread.refresh());

  return (
    <ConversationView
      title={name}
      avatarName={name}
      thread={thread as never}
      chat={chat}
      color={{ bg: theme.accent, fg: theme.accentFg }}
      scope={{ kind: "coach" }}
      presence={presence}
      onOpenInfo={() => router.push("/chat/info?cid=me" as string as Href)}
      seenMode="peer"
      peerTyping={typing.peerTyping}
      onTyping={typing.onTyping}
      banner={meta && !meta.chatEnabled ? t("chat.coachLocked") : null}
    />
  );
};
