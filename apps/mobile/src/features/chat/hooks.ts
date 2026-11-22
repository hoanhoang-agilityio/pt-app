import { useQuery } from "@tanstack/react-query";

import { isApiError } from "@/lib/errors";
import { qk } from "@/lib/query-keys";

import { useAuth } from "../auth/auth-context";
import {
  fetchBubbles,
  fetchDmInbox,
  fetchGroups,
  fetchGroupUnread,
  fetchInbox,
  fetchUnread,
} from "./api";

const BADGE_REFRESH_MS = 60_000;

const useSignedIn = () => useAuth().state.status === "signedIn";

// An admin locked by a passcode cannot read chat (403 ADMIN_LOCKED).
const useChatEnabled = () => {
  const { state } = useAuth();

  return (
    state.status === "signedIn" &&
    !(state.me.actor.kind === "admin" && state.me.actor.locked)
  );
};

export const useUnread = () => {
  const enabled = useChatEnabled();

  return useQuery({
    queryKey: qk.unread,
    queryFn: fetchUnread,
    enabled,
    refetchInterval: BADGE_REFRESH_MS,
  });
};

export const useGroupUnread = () => {
  const enabled = useChatEnabled();

  return useQuery({
    queryKey: qk.groupUnread,
    queryFn: fetchGroupUnread,
    enabled,
    refetchInterval: BADGE_REFRESH_MS,
  });
};

// Everything unread for the tab badge: coach chat, DMs and groups.
export const useUnreadTotal = () => {
  const unread = useUnread().data;
  const groups = useGroupUnread().data;

  return (unread?.count ?? 0) + (groups?.total ?? 0);
};

export const useInbox = () => {
  const { state } = useAuth();
  const isAdmin = state.status === "signedIn" && state.me.actor.kind === "admin";

  return useQuery({
    queryKey: qk.inbox,
    queryFn: fetchInbox,
    enabled: useChatEnabled() && isAdmin,
  });
};

export const useBubbles = () => {
  const { state } = useAuth();
  const isTrainee = state.status === "signedIn" && state.me.actor.kind === "user";

  return useQuery({
    queryKey: qk.bubbles,
    queryFn: fetchBubbles,
    enabled: useChatEnabled() && isTrainee,
  });
};

export const useGroups = () =>
  useQuery({ queryKey: qk.groups, queryFn: fetchGroups, enabled: useChatEnabled() });

// Trainee chats are read-only; a trainee who has not accepted the terms gets
// 403 TERMS_REQUIRED, which is just "no conversations" here.
export const useDmInbox = () => {
  const { state } = useAuth();
  const isTrainee = state.status === "signedIn" && state.me.actor.kind === "user";
  const signedIn = useSignedIn();

  return useQuery({
    queryKey: qk.dmInbox,
    queryFn: async () => {
      try {
        return await fetchDmInbox();
      } catch (error) {
        if (isApiError(error) && error.code === "TERMS_REQUIRED") {
          return { conversations: [] };
        }
        throw error;
      }
    },
    enabled: signedIn && isTrainee,
  });
};
