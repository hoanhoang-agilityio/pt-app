import {
  type ChatColorKey,
  chatEditsResponseSchema,
  chatGalleryResponseSchema,
  type ChatGalleryTab,
  chatProfileResponseSchema,
  chatSearchResponseSchema,
  chatThreadResponseSchema,
  dmOpenResponseSchema,
  groupAddMembersResponseSchema,
  groupAvatarResponseSchema,
  groupCandidatesResponseSchema,
  groupCreateResponseSchema,
  groupEditsResponseSchema,
  groupInfoResponseSchema,
  groupSeenByResponseSchema,
  realtimePresencePeerResponseSchema,
  stickerCustomResponseSchema,
} from "@pt/contracts";
import { z } from "zod";

import { api } from "@/lib/api";

// REST calls of conversation extras (search, gallery, nicknames, colour, edit
// history), group management, DM actions, presence, custom stickers and the
// super admin "original of an unsent message" reads. Responses are validated
// with the @pt/contracts schemas.

// A coach conversation is "me" for a trainee, the numeric id for an admin.
export type CoachScope = "me" | number;

const coachBase = (scope: CoachScope) => `/v1/chat/conversations/${scope}`;

// ---- Coach conversation extras ---------------------------------------------

export const searchConversation = (
  scope: CoachScope,
  q: string,
  before?: number,
) =>
  api.get(`${coachBase(scope)}/search`, {
    query: { q, before },
    schema: chatSearchResponseSchema,
  });

export const fetchGallery = (
  scope: CoachScope,
  tab: ChatGalleryTab,
  before?: number,
) =>
  api.get(`${coachBase(scope)}/gallery`, {
    query: { tab, before },
    schema: chatGalleryResponseSchema,
  });

// Shared nickname of "user", "pt" or "admin:<id>"; blank clears it.
export const setNickname = (
  scope: CoachScope,
  target: string,
  nickname: string,
) =>
  api.put(`${coachBase(scope)}/nickname`, {
    body: { target, nickname },
    schema: chatProfileResponseSchema,
  });

// An admin's colour of ONE conversation (null removes it).
export const setConversationColor = (cid: number, color: ChatColorKey | null) =>
  api.put(`/v1/chat/conversations/${cid}/color`, {
    body: { color },
    schema: chatProfileResponseSchema,
  });

// A trainee's colour is an account setting (null = default).
export const setAccountChatColor = (color: ChatColorKey | null) =>
  api.put("/v1/users/me/chat-color", { body: { color } });

export const fetchCoachEdits = (messageId: number) =>
  api.get(`/v1/chat/messages/${messageId}/edits`, {
    schema: chatEditsResponseSchema,
  });

// ---- Presence ---------------------------------------------------------------

export const sendHeartbeat = () => api.post("/v1/presence/heartbeat");

// Trainee: no userId (the PT team); admin: the trainee's id.
export const fetchPeerPresence = (userId: number | null) =>
  api.get("/v1/presence/peer", {
    query: { userId: userId ?? undefined },
    schema: realtimePresencePeerResponseSchema,
  });

// ---- Direct messages (trainee to trainee, read-only per the API) ------------

export const openDm = (otherId: number) =>
  api.post("/v1/dm/conversations", {
    body: { otherId },
    schema: dmOpenResponseSchema,
  });

export const unsendDm = (messageId: number) =>
  api.delete(`/v1/dm/messages/${messageId}`);

// ---- Groups -----------------------------------------------------------------

export const fetchGroupInfo = (groupId: number) =>
  api.get(`/v1/chat/groups/${groupId}`, { schema: groupInfoResponseSchema });

export const fetchGroupCandidates = (groupId: number | null) =>
  api.get("/v1/chat/groups/candidates", {
    query: { groupId: groupId ?? undefined },
    schema: groupCandidatesResponseSchema,
  });

export const createGroup = (input: {
  name: string;
  userIds: number[];
  ptIds: number[];
}) =>
  api.post("/v1/chat/groups", {
    body: input,
    schema: groupCreateResponseSchema,
  });

export const addGroupMembers = (
  groupId: number,
  input: { userIds: number[]; ptIds: number[] },
) =>
  api.post(`/v1/chat/groups/${groupId}/members`, {
    body: input,
    schema: groupAddMembersResponseSchema,
  });

export const removeGroupMember = (groupId: number, memberKey: string) =>
  api.delete(
    `/v1/chat/groups/${groupId}/members/${encodeURIComponent(memberKey)}`,
  );

export const leaveGroup = (groupId: number) =>
  api.post(`/v1/chat/groups/${groupId}/leave`);

export const renameGroup = (groupId: number, name: string) =>
  api.put(`/v1/chat/groups/${groupId}/name`, { body: { name } });

export const setGroupManagersOnly = (groupId: number, enabled: boolean) =>
  api.put(`/v1/chat/groups/${groupId}/managers-only`, { body: { enabled } });

export const setGroupMuted = (groupId: number, muted: boolean) =>
  api.put(`/v1/chat/groups/${groupId}/mute`, { body: { muted } });

export const setGroupAvatar = (groupId: number, dataUrl: string) =>
  api.put(`/v1/chat/groups/${groupId}/avatar`, {
    body: { dataUrl },
    schema: groupAvatarResponseSchema,
  });

export const clearGroupAvatar = (groupId: number) =>
  api.delete(`/v1/chat/groups/${groupId}/avatar`);

// Super admin only.
export const dissolveGroup = (groupId: number) =>
  api.delete(`/v1/chat/groups/${groupId}`);

export const fetchGroupSeenBy = (groupId: number, messageId: number) =>
  api.get(`/v1/chat/groups/${groupId}/messages/${messageId}/seen`, {
    schema: groupSeenByResponseSchema,
  });

export const fetchGroupEdits = (groupId: number, messageId: number) =>
  api.get(`/v1/chat/groups/${groupId}/messages/${messageId}/edits`, {
    schema: groupEditsResponseSchema,
  });

// A manager hides (or shows again) a member's message for everyone.
export const hideGroupMessage = (
  groupId: number,
  messageId: number,
  hidden: boolean,
) =>
  api.put(`/v1/chat/groups/${groupId}/messages/${messageId}/hidden`, {
    body: { hidden },
  });

// Super admin: keep the new PT or remove the change (PT-change alert line).
export const resolveGroupAlert = (
  groupId: number,
  messageId: number,
  choice: "keep" | "remove",
) =>
  api.post(`/v1/chat/groups/${groupId}/messages/${messageId}/alert`, {
    body: { choice },
  });

// ---- Custom stickers --------------------------------------------------------

export const uploadCustomSticker = (blob: Blob, contentType: string) =>
  api.upload("/v1/chat/stickers/custom", blob, contentType, {
    schema: stickerCustomResponseSchema,
  });

export const deleteCustomSticker = (id: number) =>
  api.delete(`/v1/chat/stickers/custom/${id}`);

// ---- Super admin: original of an unsent message ------------------------------

// These routes come from a parallel API change; the answer is read loosely
// (any of `body`, `text` or `original.body`) until the shape is final.
const originalSchema = z
  .object({
    body: z.string().nullable().optional(),
    text: z.string().nullable().optional(),
    original: z
      .object({ body: z.string().nullable().optional() })
      .partial()
      .nullable()
      .optional(),
  })
  .loose();

export type OriginalText = { body: string };

const toOriginal = (value: z.infer<typeof originalSchema>): OriginalText => ({
  body: value.body ?? value.text ?? value.original?.body ?? "",
});

export const originalPath = (
  scope:
    { kind: "coach" } | { kind: "dm" } | { kind: "group"; groupId: number },
  messageId: number,
) =>
  scope.kind === "coach"
    ? `/v1/chat/messages/${messageId}/original`
    : scope.kind === "dm"
      ? `/v1/dm/messages/${messageId}/original`
      : `/v1/chat/groups/${scope.groupId}/messages/${messageId}/original`;

export const fetchOriginal = async (
  scope: Parameters<typeof originalPath>[0],
  messageId: number,
) =>
  toOriginal(
    await api.get(originalPath(scope, messageId), { schema: originalSchema }),
  );

// A page of messages around one message (search result context).
export const fetchAround = (scope: CoachScope, messageId: number) =>
  api.get(`${coachBase(scope)}/messages`, {
    query: { around: messageId },
    schema: chatThreadResponseSchema,
  });
