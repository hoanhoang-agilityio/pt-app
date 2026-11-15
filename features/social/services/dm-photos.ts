import "server-only";

import { and, eq, inArray, isNotNull, isNull, lt, or } from "drizzle-orm";

import { db } from "@/db";
import { dmMessages, dmPhotos } from "@/db/schema";
import {
  groupPhotosByMessage,
  PHOTO_PENDING_TTL_MS,
  type PhotoMime,
} from "@/features/chat/utils/photo-rules";
import { resolveDmView } from "@/features/social/services/dm-access";
import type { SocialActor } from "@/features/social/types/social";

// Photos of trainee chats: storage and access. The uploader and the
// conversation always come from the session and the database.

const purgeStalePending = (now: Date) =>
  db
    .delete(dmPhotos)
    .where(
      and(
        isNull(dmPhotos.messageId),
        lt(dmPhotos.createdAt, new Date(now.getTime() - PHOTO_PENDING_TTL_MS)),
      ),
    );

export const createPendingDmPhoto = async (
  input: {
    conversationId: number;
    uploaderId: number;
    mime: PhotoMime;
    width: number;
    height: number;
    bytes: Uint8Array;
  },
  now = new Date(),
) => {
  await purgeStalePending(now);
  const [row] = await db
    .insert(dmPhotos)
    .values({
      conversationId: input.conversationId,
      uploaderId: input.uploaderId,
      mime: input.mime,
      width: input.width,
      height: input.height,
      data: Buffer.from(input.bytes),
      size: input.bytes.length,
      createdAt: now,
    })
    .returning({ id: dmPhotos.id });

  return row.id;
};

// Attachable once, by their uploader, to a message of the conversation they
// were uploaded for. True when every id qualifies.
export const areDmPhotosAttachable = async (
  photoIds: number[],
  conversationId: number,
  uploaderId: number,
) => {
  if (photoIds.length === 0) {
    return true;
  }
  if (new Set(photoIds).size !== photoIds.length) {
    return false;
  }
  const rows = await db
    .select({ id: dmPhotos.id })
    .from(dmPhotos)
    .where(
      and(
        inArray(dmPhotos.id, photoIds),
        eq(dmPhotos.conversationId, conversationId),
        eq(dmPhotos.uploaderId, uploaderId),
        isNull(dmPhotos.messageId),
      ),
    );

  return rows.length === photoIds.length;
};

export class DmPhotosNotAttachableError extends Error {}

// Attaches the photos in array order (position = index) inside the caller's
// transaction; throws when one is not a pending photo of this uploader and
// conversation, which undoes the whole send.
export const attachDmPhotosToMessage = async (
  executor: Pick<typeof db, "update">,
  input: {
    photoIds: number[];
    messageId: number;
    conversationId: number;
    uploaderId: number;
  },
) => {
  for (const [position, photoId] of input.photoIds.entries()) {
    const attached = await executor
      .update(dmPhotos)
      .set({ messageId: input.messageId, position })
      .where(
        and(
          eq(dmPhotos.id, photoId),
          eq(dmPhotos.conversationId, input.conversationId),
          eq(dmPhotos.uploaderId, input.uploaderId),
          isNull(dmPhotos.messageId),
        ),
      )
      .returning({ id: dmPhotos.id });

    if (attached.length === 0) {
      throw new DmPhotosNotAttachableError();
    }
  }
};

// The photos (size only) of many messages in one query, in display order. A
// message from before several photos has its one photo too.
export const loadPhotosOfDmMessages = async (
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
      id: dmPhotos.id,
      messageId: dmPhotos.messageId,
      position: dmPhotos.position,
      width: dmPhotos.width,
      height: dmPhotos.height,
    })
    .from(dmPhotos)
    .where(
      or(
        inArray(
          dmPhotos.messageId,
          messages.map((message) => message.id),
        ),
        coverIds.length > 0 ? inArray(dmPhotos.id, coverIds) : undefined,
      ),
    );

  return groupPhotosByMessage(
    rows,
    new Map(messages.map((message) => [message.id, message.photoId])),
  );
};

// The bytes, only for a photo of a live message in a conversation the viewer
// may open (members, or a super admin read-only). A pending upload is visible
// to no one.
export const findDmPhotoForViewer = async (
  photoId: number,
  viewer: SocialActor,
) => {
  const [row] = await db
    .select({
      mime: dmPhotos.mime,
      data: dmPhotos.data,
      conversationId: dmPhotos.conversationId,
    })
    .from(dmPhotos)
    .innerJoin(dmMessages, eq(dmMessages.id, dmPhotos.messageId))
    .where(
      and(
        eq(dmPhotos.id, photoId),
        isNotNull(dmPhotos.messageId),
        isNull(dmMessages.deletedAt),
      ),
    )
    .limit(1);

  if (!row) {
    return null;
  }
  const view = await resolveDmView(row.conversationId, viewer);

  return view ? { mime: row.mime, data: row.data } : null;
};
