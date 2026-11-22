import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useAuth } from "@/features/auth/auth-context";
import { qk } from "@/lib/query-keys";

import {
  acceptFriendRequest,
  blockUser,
  cancelFriendRequest,
  clearAlias,
  declineFriendRequest,
  fetchAliases,
  fetchBlocks,
  fetchFriendRequests,
  fetchFriends,
  fetchReports,
  sendFriendRequest,
  setAlias,
  unblockUser,
  unfriend,
} from "./api";

export const useIsTrainee = () => {
  const { state } = useAuth();

  return state.status === "signedIn" && state.me.actor.kind === "user";
};

export const useIsSuperAdmin = () => {
  const { state } = useAuth();

  return (
    state.status === "signedIn" &&
    state.me.actor.kind === "admin" &&
    state.me.actor.role === "super_admin"
  );
};

export const useFriends = () =>
  useQuery({ queryKey: qk.friends, queryFn: fetchFriends, enabled: useIsTrainee() });

export const useFriendRequests = () =>
  useQuery({ queryKey: qk.friendRequests, queryFn: fetchFriendRequests, enabled: useIsTrainee() });

export const useBlocks = () =>
  useQuery({ queryKey: qk.blocks, queryFn: fetchBlocks, enabled: useIsTrainee() });

export const useReports = () =>
  useQuery({ queryKey: qk.reports, queryFn: fetchReports, enabled: useIsSuperAdmin() });

// Every friend action refreshes the lists, the people search and profiles.
export const useRelationshipActions = () => {
  const queryClient = useQueryClient();
  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: qk.friends }),
      queryClient.invalidateQueries({ queryKey: qk.friendRequests }),
      queryClient.invalidateQueries({ queryKey: qk.blocks }),
      queryClient.invalidateQueries({ queryKey: ["social", "people"] }),
      queryClient.invalidateQueries({ queryKey: ["social", "profile"] }),
      queryClient.invalidateQueries({ queryKey: qk.feed }),
    ]);
  const options = { onSuccess: refresh };

  return {
    add: useMutation({ mutationFn: sendFriendRequest, ...options }),
    accept: useMutation({ mutationFn: acceptFriendRequest, ...options }),
    decline: useMutation({ mutationFn: declineFriendRequest, ...options }),
    cancel: useMutation({ mutationFn: cancelFriendRequest, ...options }),
    unfriend: useMutation({ mutationFn: unfriend, ...options }),
    block: useMutation({ mutationFn: blockUser, ...options }),
    unblock: useMutation({ mutationFn: unblockUser, ...options }),
  };
};

export const useAliases = () => {
  const { state } = useAuth();

  return useQuery({
    queryKey: qk.aliases,
    queryFn: fetchAliases,
    enabled: state.status === "signedIn",
    staleTime: 60_000,
  });
};

// The private nickname if I set one, else the real name.
export const useAliasName = () => {
  const aliases = useAliases().data?.aliases;

  return (key: string, realName: string) => aliases?.[key]?.trim() || realName;
};

export const useSetAlias = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ key, alias }: { key: string; alias: string }) =>
      alias.trim() === "" ? clearAlias(key).then(() => undefined) : setAlias(key, alias).then(() => undefined),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: qk.aliases }),
        queryClient.invalidateQueries({ queryKey: ["social"] }),
        queryClient.invalidateQueries({ queryKey: ["chat"] }),
      ]),
  });
};
