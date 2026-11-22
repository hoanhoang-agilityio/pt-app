import type { SocialPostResponse } from "@pt/contracts";
import {
  type InfiniteData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { qk } from "@/lib/query-keys";
import { applyReaction } from "@/lib/reactions";

import {
  deletePost,
  fetchComments,
  fetchFeed,
  fetchNotifications,
  fetchPost,
  fetchProfile,
  fetchProfilePosts,
  fetchReactors,
  fetchSocialMe,
  reactToPost,
  removePostReaction,
} from "./api";
import { updatePostEverywhere } from "./cache";

export const useSocialMe = () =>
  useQuery({ queryKey: qk.socialMe, queryFn: fetchSocialMe });

type Page = { items: SocialPostResponse[]; nextCursor: string | null };

const flatten = (data: InfiniteData<Page> | undefined) =>
  data?.pages.flatMap((page) => page.items) ?? [];

export const useFeed = (enabled = true) => {
  const query = useInfiniteQuery({
    queryKey: qk.feed,
    queryFn: ({ pageParam }) => fetchFeed(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled,
  });

  return { ...query, posts: flatten(query.data) };
};

export const useProfilePosts = (key: string) => {
  const query = useInfiniteQuery({
    queryKey: qk.profilePosts(key),
    queryFn: ({ pageParam }) => fetchProfilePosts(key, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

  return { ...query, posts: flatten(query.data) };
};

export const useProfile = (key: string) =>
  useQuery({ queryKey: qk.profile(key), queryFn: () => fetchProfile(key) });

export const usePost = (id: number, enabled = true) =>
  useQuery({ queryKey: qk.post(id), queryFn: () => fetchPost(id), enabled });

export const useReactors = (id: number, enabled: boolean) =>
  useQuery({ queryKey: qk.reactors(id), queryFn: () => fetchReactors(id), enabled });

export const useComments = (id: number) => {
  const query = useInfiniteQuery({
    queryKey: qk.comments(id),
    queryFn: ({ pageParam }) => fetchComments(id, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

  return {
    ...query,
    comments: query.data?.pages.flatMap((page) => page.items) ?? [],
  };
};

export const useNotifications = () => {
  const query = useInfiniteQuery({
    queryKey: qk.notifications,
    queryFn: ({ pageParam }) => fetchNotifications(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

  return {
    ...query,
    items: query.data?.pages.flatMap((page) => page.items) ?? [],
    unreadCount: query.data?.pages[0]?.unreadCount ?? 0,
  };
};

// Reacts (or removes my reaction with `null`) with an optimistic update; a
// failure puts the real state back.
export const useReact = (postId: number) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (emoji: string | null) =>
      emoji === null ? removePostReaction(postId) : reactToPost(postId, emoji),
    onMutate: (emoji) => {
      updatePostEverywhere(queryClient, postId, (post) => ({
        ...post,
        reactions: applyReaction(post.reactions, emoji),
      }));
    },
    onError: () => {
      void queryClient.invalidateQueries({ queryKey: ["social"] });
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: qk.reactors(postId) });
    },
  });
};

export const useDeletePost = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => deletePost(id),
    onSuccess: (_data, id) => {
      updatePostEverywhere(queryClient, id, () => null);
    },
  });
};
