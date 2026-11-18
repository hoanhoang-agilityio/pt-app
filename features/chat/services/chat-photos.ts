import "server-only";

import { and, eq, inArray, isNotNull, isNull, lt, or } from "drizzle-orm";

import { db } from "@/db";
import { chatConversations, chatMessages, chatPhotos } from "@/db/schema";
import {
  groupPhotosByMessage,
  PHOTO_PENDING_TTL_MS,
  type PhotoMime,
} from "@/features/chat/utils/photo-rules";
import { canAdminAccessUser } from "@/services/hidden-users";

// Photos in chat (KAN-160): storage and access rules. The uploader and the
// conversation always come from the session, never from the client.

export const photoUploaderKey = (
  who: { kind: "user" } | { kind: "admin"; id: number },
) => (who.kind === "user" ? "user" : `admin:${who.id}`);

// Uploads that never became a message (the person backed out) are dropped when
// the next upload comes in, so they cannot pile up.
const purgeStalePending = (now: Date) =>
  db
    .delete(chatPhotos)
    .where(
      and(
        isNull(chatPhotos.messageId),
        lt(
          chatPhotos.createdAt,
          new Date(now.getTime() - PHOTO_PENDING_TTL_MS),
        ),
      ),
    );

export const createPendingPhoto = async (
  input: {
    conversationId: number;
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
    .insert(chatPhotos)
    .values({
      conversationId: input.conversationId,
      uploaderKey: input.uploaderKey,
      mime: input.mime,
      width: input.width,
      height: input.height,
      data: Buffer.from(input.bytes),
      size: input.bytes.length,
      createdAt: now,
    })
    .returning({ id: chatPhotos.id });

  return row.id;
};

// Photos may be attached once, by the person who uploaded them, to a message in
// the conversation they were uploaded for. True when every id qualifies.
export const arePhotosAttachable = async (
  photoIds: number[],
  conversationId: number,
  uploaderKey: string,
) => {
  if (photoIds.length === 0) {
    return true;
  }
  if (new Set(photoIds).size !== photoIds.length) {
    return false;
  }
  const rows = await db
    .select({ id: chatPhotos.id })
    .from(chatPhotos)
    .where(
      and(
        inArray(chatPhotos.id, photoIds),
        eq(chatPhotos.conversationId, conversationId),
        eq(chatPhotos.uploaderKey, uploaderKey),
        isNull(chatPhotos.messageId),
      ),
    );

  return rows.length === photoIds.length;
};

export class PhotosNotAttachableError extends Error {}

type Executor = Pick<typeof db, "update">;

// Attaches the photos to the message in the array order (position = index),
// inside the caller's transaction. Throws when any of them is not a pending
// photo of this uploader and conversation, so the whole send rolls back.
export const attachPhotosToMessage = async (
  executor: Executor,
  input: {
    photoIds: number[];
    messageId: number;
    conversationId: number;
    uploaderKey: string;
  },
) => {
  for (const [position, photoId] of input.photoIds.entries()) {
    const attached = await executor
      .update(chatPhotos)
      .set({ messageId: input.messageId, position })
      .where(
        and(
          eq(chatPhotos.id, photoId),
          eq(chatPhotos.conversationId, input.conversationId),
          eq(chatPhotos.uploaderKey, input.uploaderKey),
          isNull(chatPhotos.messageId),
        ),
      )
      .returning({ id: chatPhotos.id });

    if (attached.length === 0) {
      throw new PhotosNotAttachableError();
    }
  }
};

// The photos (size only, no bytes) of many messages in one query, in display
// order. A message from before several photos has its one photo too.
export const loadPhotosOfMessages = async (
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
      id: chatPhotos.id,
      messageId: chatPhotos.messageId,
      position: chatPhotos.position,
      width: chatPhotos.width,
      height: chatPhotos.height,
    })
    .from(chatPhotos)
    .where(
      or(
        inArray(
          chatPhotos.messageId,
          messages.map((message) => message.id),
        ),
        coverIds.length > 0 ? inArray(chatPhotos.id, coverIds) : undefined,
      ),
    );

  return groupPhotosByMessage(
    rows,
    new Map(messages.map((message) => [message.id, message.photoId])),
  );
};

// How many photos each of the messages carries (one for a message from before
// several photos); messages without photos are absent.
export const countPhotosOfMessages = async (
  messages: { id: number; photoId: number | null }[],
) => {
  const photos = await loadPhotosOfMessages(messages);

  return new Map(
    [...photos].map(([messageId, list]) => [messageId, list.length]),
  );
};

export type PhotoViewer = { kind: "user" | "admin"; id: number };

// The trainee of the conversation, and any admin who can access that trainee
// (a hidden one only after the passcode reveal). Only photos that belong to a
// live (not unsent) message are served; a pending upload is not visible to
// anyone, and an unsent message's photo stays stored but is never served.
export const findPhotoForViewer = async (id: number, viewer: PhotoViewer) => {
  const [photo] = await db
    .select({
      mime: chatPhotos.mime,
      data: chatPhotos.data,
      traineeId: chatConversations.userId,
    })
    .from(chatPhotos)
    .innerJoin(
      chatConversations,
      eq(chatConversations.id, chatPhotos.conversationId),
    )
    .innerJoin(chatMessages, eq(chatMessages.id, chatPhotos.messageId))
    .where(
      and(
        eq(chatPhotos.id, id),
        isNotNull(chatPhotos.messageId),
        isNull(chatMessages.deletedAt),
      ),
    );

  if (!photo) {
    return null;
  }
  const allowed =
    viewer.kind === "user"
      ? photo.traineeId === viewer.id
      : await canAdminAccessUser(viewer.id, photo.traineeId);

  return allowed ? { mime: photo.mime, data: photo.data } : null;
};
