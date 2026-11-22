import { useQuery } from "@tanstack/react-query";
import { type Href, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";

import { ErrorState, Screen, Spinner } from "@/components/ui";
import { useAuth } from "@/features/auth/auth-context";
import { useErrorText } from "@/lib/ui-helpers";
import { useTheme } from "@/theme";

import { coachApi, type CoachMeta, fetchTraineeConversation } from "../api";
import { ConversationView } from "../components/ConversationView";
import { usePeerPresence } from "../presence";
import { useRealtime } from "../realtime";
import { useRefreshOnFocus } from "../use-refresh-on-focus";
import { useThread } from "../use-thread";
import { useTyping } from "../use-typing";

const TraineeThread = ({
  userId,
  conversationId,
  name,
  avatarUrl,
  chatEnabled,
}: {
  userId: number;
  conversationId: number | null;
  name: string;
  avatarUrl: string | null;
  chatEnabled: boolean;
}) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const { state } = useAuth();
  const adminId = state.status === "signedIn" ? state.me.actor.id : 0;
  const { follow } = useRealtime();
  const { load, chat } = useMemo(
    () => coachApi({ kind: "admin", adminId }, conversationId, userId),
    [adminId, conversationId, userId],
  );
  const liveConversationId = useRef(conversationId);
  const thread = useThread<CoachMeta>({
    target: { kind: "coach", conversationId },
    load,
    // The conversation may only exist after the admin's first reply, so read
    // against the id the thread reports, not the one the screen opened with.
    onRead: async (id) => {
      if (liveConversationId.current === null) {
        return;
      }
      await coachApi(
        { kind: "admin", adminId },
        liveConversationId.current,
        userId,
      ).chat.markRead(id);
    },
  });
  const liveId = thread.meta?.conversationId ?? conversationId;

  useEffect(() => {
    liveConversationId.current = liveId;
  }, [liveId]);
  const presence = usePeerPresence(userId, true);
  const isSuperAdmin =
    state.status === "signedIn" &&
    state.me.actor.kind === "admin" &&
    state.me.actor.role === "super_admin";
  const nickname = thread.meta?.profile.nicknames.user;

  useRefreshOnFocus(() => void thread.refresh());
  const typing = useTyping({
    conversationId,
    myRole: "admin",
    myKey: `admin:${adminId}`,
  });

  useEffect(() => {
    if (conversationId === null) {
      return undefined;
    }
    return follow(conversationId);
  }, [follow, conversationId]);

  return (
    <ConversationView
      title={nickname || name}
      avatarName={nickname || name}
      avatarUri={avatarUrl}
      thread={thread as never}
      chat={chat}
      color={{ bg: theme.accent, fg: theme.accentFg }}
      scope={{ kind: "coach" }}
      isSuperAdmin={isSuperAdmin}
      presence={presence}
      onOpenInfo={
        conversationId === null
          ? undefined
          : () =>
              router.push(
                `/chat/info?cid=${conversationId}&userId=${userId}` as string as Href,
              )
      }
      seenMode="peer"
      peerTyping={typing.peerTyping}
      onTyping={typing.onTyping}
      banner={chatEnabled ? null : t("chat.coachLocked")}
    />
  );
};

// Admin side: one trainee's conversation, found by the trainee's user id.
export const TraineeChatScreen = () => {
  const params = useLocalSearchParams<{ userId: string }>();
  const userId = Number(params.userId);
  const errorText = useErrorText();
  const header = useQuery({
    queryKey: ["chat", "trainee", userId],
    queryFn: () => fetchTraineeConversation(userId),
    enabled: Number.isInteger(userId) && userId > 0,
  });

  if (header.isPending) {
    return (
      <Screen>
        <Spinner />
      </Screen>
    );
  }
  if (header.isError) {
    return (
      <Screen>
        <ErrorState
          message={errorText(header.error)}
          onRetry={() => void header.refetch()}
        />
      </Screen>
    );
  }
  return (
    <TraineeThread
      userId={userId}
      conversationId={header.data.conversationId}
      name={header.data.displayName}
      avatarUrl={header.data.avatarUrl}
      chatEnabled={header.data.chatEnabled}
    />
  );
};
