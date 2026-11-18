import "server-only";

import { and, eq, inArray, isNotNull, isNull, lt, or } from "drizzle-orm";

import { db } from "@/db";
import { chatGroupMessages, chatGroupPhotos, chatGroups } from "@/db/schema";
import { decodeAvatarDataUrl } from "@/features/avatar/utils/avatar-rules";
import {
  groupPhotosByMessage,
  PHOTO_PENDING_TTL_MS,
  type PhotoMime,
} from "@/features/chat/utils/photo-rules";
import { loadGroupActor } from "@/features/chat-groups/services/group-access";
import type { GroupSession } from "@/features/chat-groups/types/group";

// Photos in groups: storage and access rules, mirroring chat-photos.ts. The
// uploader and the group always come from the session and loadGroupActor,
// never from the client.

const purgeStalePending = (now: Date) =>
  db
    .delete(chatGroupPhotos)
    .where(
      and(
        isNull(chatGroupPhotos.messageId),
        lt(
          chatGroupPhotos.createdAt,
          new Date(now.getTime() - PHOTO_PENDING_TTL_MS),
        ),
      ),
    );

export const createPendingGroupPhoto = async (
  input: {
    groupId: number;
    uploaderKey: string;
    mime: PhotoMime;
    width: number;
    height: number;
    bytes: Uint8Array;
  },
  now = new Date(),
) => {
  await purgeStalePending(now);
  const [row] = await db
    .insert(chatGroupPhotos)
    .values({
      groupId: input.groupId,
      uploaderKey: input.uploaderKey,
      mime: input.mime,
      width: input.width,
      height: input.height,
      data: Buffer.from(input.bytes),
      size: input.bytes.length,
      createdAt: now,
    })
    .returning({ id: chatGroupPhotos.id });

  return row.id;
};

// Attachable once, by their uploader, to a message of the group they were
// uploaded for. True when every id qualifies.
export const areGroupPhotosAttachable = async (
  photoIds: number[],
  groupId: number,
  uploaderKey: string,
) => {
  if (photoIds.length === 0) {
    return true;
  }
  if (new Set(photoIds).size !== photoIds.length) {
    return false;
  }
  const rows = await db
    .select({ id: chatGroupPhotos.id })
    .from(chatGroupPhotos)
    .where(
      and(
        inArray(chatGroupPhotos.id, photoIds),
        eq(chatGroupPhotos.groupId, groupId),
        eq(chatGroupPhotos.uploaderKey, uploaderKey),
        isNull(chatGroupPhotos.messageId),
      ),
    );

  return rows.length === photoIds.length;
};

export class GroupPhotosNotAttachableError extends Error {}

// Attaches the photos in array order (position = index) inside the caller's
// transaction; throws when one is not a pending photo of this uploader and
// group, which undoes the whole send.
export const attachGroupPhotosToMessage = async (
  executor: Pick<typeof db, "update">,
  input: {
    photoIds: number[];
    messageId: number;
    groupId: number;
    uploaderKey: string;
  },
) => {
  for (const [position, photoId] of input.photoIds.entries()) {
    const attached = await executor
      .update(chatGroupPhotos)
      .set({ messageId: input.messageId, position })
      .where(
        and(
          eq(chatGroupPhotos.id, photoId),
          eq(chatGroupPhotos.groupId, input.groupId),
          eq(chatGroupPhotos.uploaderKey, input.uploaderKey),
          isNull(chatGroupPhotos.messageId),
        ),
      )
      .returning({ id: chatGroupPhotos.id });

    if (attached.length === 0) {
      throw new GroupPhotosNotAttachableError();
    }
  }
};

// The photos (size only) of many messages in one query, in display order. A
// message from before several photos has its one photo too.
export const loadPhotosOfGroupMessages = async (
  messages: { id: number; photoId: number | null }[],
) => {
  if (messages.length === 0) {
    return new Map<number, { id: number; width: number; height: number }[]>();
  }
  const coverIds = messages.flatMap((message) =>
    message.photoId === null ? [] : [message.photoId],
  );
  const rows = await db
    .select({
      id: chatGroupPhotos.id,
      messageId: chatGroupPhotos.messageId,
      position: chatGroupPhotos.position,
      width: chatGroupPhotos.width,
      height: chatGroupPhotos.height,
    })
    .from(chatGroupPhotos)
    .where(
      or(
        inArray(
          chatGroupPhotos.messageId,
          messages.map((message) => message.id),
        ),
        coverIds.length > 0 ? inArray(chatGroupPhotos.id, coverIds) : undefined,
      ),
    );

  return groupPhotosByMessage(
    rows,
    new Map(messages.map((message) => [message.id, message.photoId])),
  );
};

// The photo of a live (not unsent) message, only for a member of its group (a pending
// upload is visible to nobody). Null = answer 404.
export const findGroupPhotoForSession = async (
  photoId: number,
  session: GroupSession,
  groupId?: number,
) => {
  const [photo] = await db
    .select({
      groupId: chatGroupPhotos.groupId,
      mime: chatGroupPhotos.mime,
      data: chatGroupPhotos.data,
    })
    .from(chatGroupPhotos)
    .innerJoin(
      chatGroupMessages,
      eq(chatGroupMessages.id, chatGroupPhotos.messageId),
    )
    .where(
      and(
        eq(chatGroupPhotos.id, photoId),
        isNotNull(chatGroupPhotos.messageId),
        isNull(chatGroupMessages.deletedAt),
        groupId === undefined
          ? undefined
          : eq(chatGroupPhotos.groupId, groupId),
      ),
    );

  if (!photo || !(await loadGroupActor(photo.groupId, session))) {
    return null;
  }
  return { mime: photo.mime, data: photo.data };
};

// The group's photo as bytes (a validated data URL on the row). The route
// calls loadGroupActor first.
export const loadGroupAvatar = async (groupId: number) => {
  const [row] = await db
    .select({ avatar: chatGroups.avatar })
    .from(chatGroups)
    .where(eq(chatGroups.id, groupId))
    .limit(1);
  const decoded = row?.avatar ? decodeAvatarDataUrl(row.avatar) : null;

  return decoded?.ok ? { mime: decoded.mime, bytes: decoded.bytes } : null;
};
