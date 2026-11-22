import { type Href, useLocalSearchParams, useRouter } from "expo-router";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Alert } from "react-native";

import { useAuth } from "@/features/auth/auth-context";
import { useErrorText } from "@/lib/ui-helpers";
import { useTheme } from "@/theme";

import { groupApi, type GroupMeta } from "../api";
import { hideGroupMessage, resolveGroupAlert } from "../api-manage";
import { ConversationView } from "../components/ConversationView";
import { useRefreshOnFocus } from "../use-refresh-on-focus";
import { useThread } from "../use-thread";

export const GroupChatScreen = () => {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const errorText = useErrorText();
  const params = useLocalSearchParams<{ id: string }>();
  const groupId = Number(params.id);
  const { state } = useAuth();
  const actor = state.status === "signedIn" ? state.me.actor : null;
  const viewerKey = actor
    ? `${actor.kind === "admin" ? "admin" : "user"}:${actor.id}`
    : "";
  const { load, chat } = useMemo(
    () => groupApi(groupId, viewerKey),
    [groupId, viewerKey],
  );
  const thread = useThread<GroupMeta>({
    target: { kind: "group", groupId },
    load,
    onRead: (id) => chat.markRead(id),
  });
  const meta = thread.meta;

  useRefreshOnFocus(() => void thread.refresh());
  const act = (run: () => Promise<unknown>) =>
    run().then(
      () => void thread.sync(),
      (error: unknown) => Alert.alert(errorText(error)),
    );
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
      scope={{ kind: "group", groupId }}
      seenMode="count"
      isSuperAdmin={meta?.isSuperAdmin ?? false}
      canHide={(meta?.canManage ?? false) && !meta?.dissolved}
      onHide={(message, hidden) =>
        message.id !== null &&
        void act(() => hideGroupMessage(groupId, message.id as number, hidden))
      }
      onAlert={(message, choice) =>
        message.id !== null &&
        void act(() => resolveGroupAlert(groupId, message.id as number, choice))
      }
      onOpenInfo={() =>
        router.push(`/chat/group-info/${groupId}` as string as Href)
      }
      banner={banner}
    />
  );
};
