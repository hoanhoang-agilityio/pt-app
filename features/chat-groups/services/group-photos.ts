import "server-only";

import { and, eq, isNotNull, isNull, lt } from "drizzle-orm";

import { db } from "@/db";
import { chatGroupPhotos, chatGroups } from "@/db/schema";
import { decodeAvatarDataUrl } from "@/features/avatar/utils/avatar-rules";
import {
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

// Attachable once, by its uploader, to a message of the group it was
// uploaded for.
export const isGroupPhotoAttachable = async (
  photoId: number,
  groupId: number,
  uploaderKey: string,
) => {
  const [row] = await db
    .select({ id: chatGroupPhotos.id })
    .from(chatGroupPhotos)
    .where(
      and(
        eq(chatGroupPhotos.id, photoId),
        eq(chatGroupPhotos.groupId, groupId),
        eq(chatGroupPhotos.uploaderKey, uploaderKey),
        isNull(chatGroupPhotos.messageId),
      ),
    );

  return Boolean(row);
};

export const attachGroupPhotoToMessage = async (
  photoId: number,
  messageId: number,
) => {
  await db
    .update(chatGroupPhotos)
    .set({ messageId })
    .where(
      and(eq(chatGroupPhotos.id, photoId), isNull(chatGroupPhotos.messageId)),
    );
};

// Unsend: the stored image goes with the message.
export const deleteGroupPhotoOfMessage = async (messageId: number) => {
  await db
    .delete(chatGroupPhotos)
    .where(eq(chatGroupPhotos.messageId, messageId));
};

// The photo of a stored message, only for a member of its group (a pending
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
    .where(
      and(
        eq(chatGroupPhotos.id, photoId),
        isNotNull(chatGroupPhotos.messageId),
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
