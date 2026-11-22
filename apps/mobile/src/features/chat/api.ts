import {
  chatBubblesResponseSchema,
  chatConversationResponseSchema,
  chatInboxResponseSchema,
  chatMessageResponseSchema,
  chatPhotoResponseSchema,
  type ChatProfile,
  chatThreadResponseSchema,
  dmInboxResponseSchema,
  dmThreadResponseSchema,
  groupListResponseSchema,
  groupMessageResponseSchema,
  groupPhotoResponseSchema,
  groupThreadResponseSchema,
  groupUnreadResponseSchema,
  stickerCustomListResponseSchema,
  stickerGiphyResponseSchema,
} from "@pt/contracts";

import { api } from "@/lib/api";
import { unreadWithBadgeSchema } from "@/lib/badge";
import {
  type ChatMsg,
  fromCoachMessage,
  fromDmMessage,
  fromGroupMessage,
  type Viewer,
} from "@/lib/chat-model";
import { PHOTO_CONTENT_TYPE, type PreparedPhoto } from "@/lib/photos";

// REST calls of the messenger (/v1/chat, /v1/dm), each turned into the shared
// ChatMsg model. Thread reads follow the API's cursor rules: no cursor = the
// latest page, `before` = older, `after` + `changedSince` = what is new or
// changed since the last fetch.

export type ThreadQuery = {
  before?: number;
  after?: number;
  changedSince?: number;
};

export type ThreadPage<Meta> = {
  messages: ChatMsg[];
  changes: ChatMsg[];
  hasMore: boolean;
  lastChangeAt: number;
  peerReadUpTo: number;
  removedIds: number[];
  meta: Meta;
};

export type SendPayload = {
  body?: string;
  photoIds?: number[];
  replyToMessageId?: number;
  sticker?: unknown;
};

export type ChatApi = {
  send: (payload: SendPayload, clientId: string) => Promise<ChatMsg>;
  edit: (messageId: number, body: string) => Promise<void>;
  unsend: (messageId: number) => Promise<void>;
  react: (messageId: number, emoji: string | null) => Promise<void>;
  markRead: (lastReadMessageId: number) => Promise<void>;
  uploadPhoto: (photo: PreparedPhoto) => Promise<number>;
};

// ---- Inbox, badges, lists ---------------------------------------------------

export const fetchInbox = () =>
  api.get("/v1/chat/inbox", { schema: chatInboxResponseSchema });

export const fetchUnread = () =>
  api.get("/v1/chat/unread", { schema: unreadWithBadgeSchema });

export const fetchBubbles = () =>
  api.get("/v1/chat/bubbles", { schema: chatBubblesResponseSchema });

export const fetchGroups = () =>
  api.get("/v1/chat/groups", { schema: groupListResponseSchema });

export const fetchGroupUnread = () =>
  api.get("/v1/chat/groups/unread", { schema: groupUnreadResponseSchema });

export const fetchDmInbox = () =>
  api.get("/v1/dm/conversations", { schema: dmInboxResponseSchema });

export const fetchTraineeConversation = (userId: number) =>
  api.get(`/v1/chat/trainees/${userId}/conversation`, {
    schema: chatConversationResponseSchema,
  });

// ---- Coach chat (trainee: conversations/me, admin: conversations/:cid) ------

export type CoachMeta = {
  conversationId: number | null;
  chatEnabled: boolean;
  userId?: number;
  latestPtName: string | null;
  latestPtId: number | null;
  profile: ChatProfile;
  peerLastSeenAt: string | null;
};

export const EMPTY_PROFILE: ChatProfile = { nicknames: {}, colors: {} };

export const coachApi = (
  viewer: Extract<Viewer, { kind: "trainee" | "admin" }>,
  conversationId: number | null,
  traineeUserId: number | null,
) => {
  const base =
    viewer.kind === "trainee"
      ? "/v1/chat/conversations/me"
      : `/v1/chat/conversations/${conversationId}`;
  const sendPath =
    viewer.kind === "trainee"
      ? "/v1/chat/conversations/me/messages"
      : `/v1/chat/trainees/${traineeUserId}/messages`;
  const photoPath =
    viewer.kind === "trainee"
      ? "/v1/chat/photos"
      : `/v1/chat/trainees/${traineeUserId}/photos`;

  const load = async (query: ThreadQuery): Promise<ThreadPage<CoachMeta>> => {
    // An admin has nothing to read until the conversation exists.
    if (viewer.kind === "admin" && conversationId === null) {
      return {
        messages: [],
        changes: [],
        hasMore: false,
        lastChangeAt: 0,
        peerReadUpTo: 0,
        removedIds: [],
        meta: {
          conversationId: null,
          chatEnabled: true,
          latestPtName: null,
          latestPtId: null,
          profile: EMPTY_PROFILE,
          peerLastSeenAt: null,
        },
      };
    }
    const response = await api.get(`${base}/messages`, {
      query,
      schema: chatThreadResponseSchema,
    });

    // 204: nothing changed since the last fetch.
    if (response === undefined) {
      return {
        messages: [],
        changes: [],
        hasMore: false,
        lastChangeAt: query.changedSince ?? 0,
        peerReadUpTo: 0,
        removedIds: [],
        meta: {
          conversationId,
          chatEnabled: true,
          latestPtName: null,
          latestPtId: null,
          profile: EMPTY_PROFILE,
          peerLastSeenAt: null,
        },
      };
    }
    return {
      messages: response.messages.map((m) =>
        fromCoachMessage(m, viewer, response.profile.colors),
      ),
      changes: response.changes.map((m) =>
        fromCoachMessage(m, viewer, response.profile.colors),
      ),
      hasMore: response.hasMore,
      lastChangeAt: response.lastChangeAt,
      peerReadUpTo: response.peerReadUpTo,
      removedIds: [],
      meta: {
        conversationId: response.conversationId,
        chatEnabled: response.chatEnabled,
        userId: response.userId,
        latestPtName: response.latestPt?.name ?? null,
        latestPtId: response.latestPt?.id ?? null,
        profile: response.profile,
        peerLastSeenAt: response.peerLastSeenAt,
      },
    };
  };

  const chat: ChatApi = {
    send: async (payload, clientId) => {
      const result = await api.post(sendPath, {
        body: { ...payload, clientId },
        idempotencyKey: clientId,
        schema: chatMessageResponseSchema,
      });

      return fromCoachMessage(result.message, viewer);
    },
    edit: async (id, body) => {
      await api.patch(`/v1/chat/messages/${id}`, { body: { body } });
    },
    unsend: async (id) => {
      await api.delete(`/v1/chat/messages/${id}`);
    },
    react: async (id, emoji) => {
      if (emoji === null) {
        await api.delete(`/v1/chat/messages/${id}/reaction`);
      } else {
        await api.put(`/v1/chat/messages/${id}/reaction`, { body: { emoji } });
      }
    },
    markRead: async (lastReadMessageId) => {
      await api.post(`${base}/read`, { body: { lastReadMessageId } });
    },
    uploadPhoto: async (photo) => {
      const result = await api.upload(
        photoPath,
        photo.blob,
        PHOTO_CONTENT_TYPE,
        {
          schema: chatPhotoResponseSchema,
        },
      );

      return result.photo.id;
    },
  };

  return { load, chat };
};

// ---- Group chat --------------------------------------------------------------

export type GroupMeta = {
  name: string;
  avatarUrl: string | null;
  managersOnly: boolean;
  dissolved: boolean;
  sendBlock: string | null;
  muted: boolean;
  canManage: boolean;
  isManager: boolean;
  isSuperAdmin: boolean;
};

export const groupApi = (groupId: number, viewerKey: string) => {
  const base = `/v1/chat/groups/${groupId}`;

  const load = async (query: ThreadQuery): Promise<ThreadPage<GroupMeta>> => {
    const response = await api.get(`${base}/messages`, {
      query,
      schema: groupThreadResponseSchema,
    });

    return {
      messages: response.messages.map((m) => fromGroupMessage(m, viewerKey)),
      changes: response.changes.map((m) => fromGroupMessage(m, viewerKey)),
      hasMore: response.hasMore,
      lastChangeAt: response.lastChangeAt,
      peerReadUpTo: 0,
      removedIds: [],
      meta: {
        name: response.group.name,
        avatarUrl: response.group.avatarUrl,
        managersOnly: response.group.managersOnly,
        dissolved: response.group.dissolved,
        sendBlock: response.viewer.sendBlock,
        muted: response.viewer.muted,
        canManage: response.viewer.canManage,
        isManager: response.viewer.isManager,
        isSuperAdmin: response.viewer.isSuperAdmin,
      },
    };
  };

  const chat: ChatApi = {
    send: async (payload, clientId) => {
      const result = await api.post(`${base}/messages`, {
        body: { ...payload, clientId },
        idempotencyKey: clientId,
        schema: groupMessageResponseSchema,
      });

      return fromGroupMessage(result.message, viewerKey);
    },
    edit: async (id, body) => {
      await api.patch(`${base}/messages/${id}`, { body: { body } });
    },
    unsend: async (id) => {
      await api.delete(`${base}/messages/${id}`);
    },
    react: async (id, emoji) => {
      if (emoji === null) {
        await api.delete(`${base}/messages/${id}/reaction`);
      } else {
        await api.put(`${base}/messages/${id}/reaction`, { body: { emoji } });
      }
    },
    markRead: async (lastReadMessageId) => {
      await api.post(`${base}/read`, { body: { lastReadMessageId } });
    },
    uploadPhoto: async (photo) => {
      const result = await api.upload(
        `${base}/photos`,
        photo.blob,
        PHOTO_CONTENT_TYPE,
        {
          schema: groupPhotoResponseSchema,
        },
      );

      return result.photo.id;
    },
  };

  return { load, chat };
};

// ---- Trainee to trainee (read-only) -----------------------------------------

export const dmApi = (conversationId: number, myUserId: number) => {
  const base = `/v1/dm/conversations/${conversationId}`;

  const load = async (
    query: ThreadQuery,
  ): Promise<ThreadPage<{ readOnly: boolean }>> => {
    const response = await api.get(`${base}/messages`, {
      query: { before: query.before, after: query.after },
      schema: dmThreadResponseSchema,
    });

    return {
      messages: response.messages.map((m) => fromDmMessage(m, myUserId)),
      changes: [],
      hasMore: response.hasMore,
      lastChangeAt: 0,
      peerReadUpTo: response.otherReadUpTo,
      removedIds: response.deletedIds,
      meta: { readOnly: response.isReadOnly },
    };
  };

  // The whole conversation is marked read: no body.
  const markRead = async () => {
    await api.post(`${base}/read`);
  };

  // Sending is switched off by the API (403 DM_DISABLED); a member can still
  // take back an old message of their own (the photo bytes go too).
  const chat: ChatApi = {
    send: () => Promise.reject(new Error("DM_DISABLED")),
    edit: () => Promise.resolve(),
    unsend: async (id) => {
      await api.delete(`/v1/dm/messages/${id}`);
    },
    react: () => Promise.resolve(),
    markRead: () => markRead(),
    uploadPhoto: () => Promise.reject(new Error("DM_DISABLED")),
  };

  return { load, markRead, chat };
};

// ---- Stickers ---------------------------------------------------------------

export const fetchGiphy = (q: string) =>
  api.get("/v1/chat/stickers/giphy", {
    query: { q: q || undefined },
    schema: stickerGiphyResponseSchema,
  });

export const fetchCustomStickers = () =>
  api.get("/v1/chat/stickers/custom", {
    schema: stickerCustomListResponseSchema,
  });
