import {
  socialCommentPageResponseSchema,
  socialCreatePostResponseSchema,
  socialMeResponseSchema,
  socialNotificationPageResponseSchema,
  socialPhotoUploadResponseSchema,
  socialPostPageResponseSchema,
  type SocialPostPrivacy,
  socialPostResponseSchema,
  socialProfileResponseSchema,
  socialReactorsResponseSchema,
} from "@pt/contracts";

import { api } from "@/lib/api";
import { PHOTO_CONTENT_TYPE, type PreparedPhoto } from "@/lib/photos";

// The social API (/v1/social/*) as typed calls. Responses are validated with
// the @pt/contracts schemas. Reaction requests are NOT validated with the
// contract's emoji enum: the API is moving to "any single emoji" and the app
// checks that itself (lib/emoji.ts).

const PAGE = 10;

export const fetchSocialMe = () =>
  api.get("/v1/social/me", { schema: socialMeResponseSchema });

export const acceptTerms = () => api.post("/v1/social/me/terms");

export const fetchFeed = (cursor?: string) =>
  api.get("/v1/social/feed", {
    query: { cursor, limit: PAGE },
    schema: socialPostPageResponseSchema,
  });

export const fetchProfilePosts = (key: string, cursor?: string) =>
  api.get(`/v1/social/profiles/${encodeURIComponent(key)}/posts`, {
    query: { cursor, limit: PAGE },
    schema: socialPostPageResponseSchema,
  });

export const fetchProfile = (key: string) =>
  api.get(`/v1/social/profiles/${encodeURIComponent(key)}`, {
    schema: socialProfileResponseSchema,
  });

export const fetchPost = (id: number) =>
  api.get(`/v1/social/posts/${id}`, { schema: socialPostResponseSchema });

// Photos are uploaded first (raw bytes), then the post names their ids.
export const uploadPostPhoto = async (photo: PreparedPhoto) => {
  const result = await api.upload("/v1/social/photos", photo.blob, PHOTO_CONTENT_TYPE, {
    schema: socialPhotoUploadResponseSchema,
  });

  return result.photo.id;
};

// One idempotency key per submit: a retry returns the first post.
export const createPost = (
  input: { caption: string; privacy: SocialPostPrivacy; photoIds: number[] },
  idempotencyKey: string,
) =>
  api.post("/v1/social/posts", {
    body: input,
    idempotencyKey,
    schema: socialCreatePostResponseSchema,
  });

export const editPost = (
  id: number,
  input: { caption: string; privacy: SocialPostPrivacy },
) => api.patch(`/v1/social/posts/${id}`, { body: input });

export const deletePost = (id: number) => api.delete(`/v1/social/posts/${id}`);

export const reactToPost = (id: number, emoji: string) =>
  api.put(`/v1/social/posts/${id}/reaction`, { body: { emoji } });

export const removePostReaction = (id: number) =>
  api.delete(`/v1/social/posts/${id}/reaction`);

export const fetchReactors = (id: number) =>
  api.get(`/v1/social/posts/${id}/reactions`, {
    schema: socialReactorsResponseSchema,
  });

export const fetchComments = (id: number, cursor?: string) =>
  api.get(`/v1/social/posts/${id}/comments`, {
    query: { cursor, limit: 50 },
    schema: socialCommentPageResponseSchema,
  });

export const addComment = (postId: number, body: string) =>
  api.post(`/v1/social/posts/${postId}/comments`, { body: { body } });

export const editComment = (id: number, body: string) =>
  api.patch(`/v1/social/comments/${id}`, { body: { body } });

export const deleteComment = (id: number) =>
  api.delete(`/v1/social/comments/${id}`);

export const fetchNotifications = (cursor?: string) =>
  api.get("/v1/social/notifications", {
    query: { cursor, limit: 50 },
    schema: socialNotificationPageResponseSchema,
  });

export const markNotificationsRead = () =>
  api.post("/v1/social/notifications/read");
