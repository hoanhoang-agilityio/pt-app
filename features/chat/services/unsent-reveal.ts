import "server-only";

import { and, asc, eq, isNotNull, or } from "drizzle-orm";

import { db } from "@/db";
import {
  chatGroupMessages,
  chatGroupPhotos,
  chatMessages,
  chatPhotos,
  dmMessages,
  dmPhotos,
} from "@/db/schema";
import {
  type ChatPhoto,
  PHOTO_ALT,
  type PhotoMime,
} from "@/features/chat/utils/photo-rules";
import {
  type ChatSticker,
  toChatSticker,
} from "@/features/chat/utils/sticker-rules";

export type UnsentKind = "coach" | "dm" | "group";

// What a super admin gets back for one unsent message. Photos are inline data
// URLs: the photo routes refuse unsent photos on purpose, and there is no
// public route for them.
export interface RevealedUnsent {
  body: string;
  sticker: ChatSticker | null;
  photos: ChatPhoto[];
}

interface PhotoRow {
  mime: PhotoMime;
  width: number;
  height: number;
  data: Buffer;
}

const toInlinePhotos = (rows: PhotoRow[]): ChatPhoto[] =>
  rows.map((row) => ({
    url: `data:${row.mime};base64,${Buffer.from(row.data).toString("base64")}`,
    width: row.width,
    height: row.height,
    alt: PHOTO_ALT,
  }));

const loadCoach = async (messageId: number): Promise<RevealedUnsent | null> => {
  const [row] = await db
    .select({
      body: chatMessages.body,
      stickerRef: chatMessages.stickerRef,
      stickerUrl: chatMessages.stickerUrl,
      photoId: chatMessages.photoId,
    })
    .from(chatMessages)
    .where(
      and(eq(chatMessages.id, messageId), isNotNull(chatMessages.deletedAt)),
    )
    .limit(1);

  if (!row) {
    return null;
  }
  const photos = await db
    .select({
      mime: chatPhotos.mime,
      width: chatPhotos.width,
      height: chatPhotos.height,
      data: chatPhotos.data,
    })
    .from(chatPhotos)
    .where(
      or(
        eq(chatPhotos.messageId, messageId),
        row.photoId === null ? undefined : eq(chatPhotos.id, row.photoId),
      ),
    )
    .orderBy(asc(chatPhotos.position), asc(chatPhotos.id));

  return {
    body: row.body,
    sticker: toChatSticker(row.stickerRef, row.stickerUrl),
    photos: toInlinePhotos(photos),
  };
};

const loadDm = async (messageId: number): Promise<RevealedUnsent | null> => {
  const [row] = await db
    .select({ body: dmMessages.body, photoId: dmMessages.photoId })
    .from(dmMessages)
    .where(and(eq(dmMessages.id, messageId), isNotNull(dmMessages.deletedAt)))
    .limit(1);

  if (!row) {
    return null;
  }
  const photos = await db
    .select({
      mime: dmPhotos.mime,
      width: dmPhotos.width,
      height: dmPhotos.height,
      data: dmPhotos.data,
    })
    .from(dmPhotos)
    .where(
      or(
        eq(dmPhotos.messageId, messageId),
        row.photoId === null ? undefined : eq(dmPhotos.id, row.photoId),
      ),
    )
    .orderBy(asc(dmPhotos.position), asc(dmPhotos.id));

  return {
    body: row.body ?? "",
    sticker: null,
    photos: toInlinePhotos(photos),
  };
};

const loadGroup = async (messageId: number): Promise<RevealedUnsent | null> => {
  const [row] = await db
    .select({
      body: chatGroupMessages.body,
      stickerRef: chatGroupMessages.stickerRef,
      stickerUrl: chatGroupMessages.stickerUrl,
      photoId: chatGroupMessages.photoId,
    })
    .from(chatGroupMessages)
    .where(
      and(
        eq(chatGroupMessages.id, messageId),
        eq(chatGroupMessages.kind, "message"),
        isNotNull(chatGroupMessages.deletedAt),
      ),
    )
    .limit(1);

  if (!row) {
    return null;
  }
  const photos = await db
    .select({
      mime: chatGroupPhotos.mime,
      width: chatGroupPhotos.width,
      height: chatGroupPhotos.height,
      data: chatGroupPhotos.data,
    })
    .from(chatGroupPhotos)
    .where(
      or(
        eq(chatGroupPhotos.messageId, messageId),
        row.photoId === null ? undefined : eq(chatGroupPhotos.id, row.photoId),
      ),
    )
    .orderBy(asc(chatGroupPhotos.position), asc(chatGroupPhotos.id));

  return {
    body: row.body,
    sticker: toChatSticker(row.stickerRef, row.stickerUrl),
    photos: toInlinePhotos(photos),
  };
};

// The original content of one UNSENT message, or null when the message does
// not exist or is still live. Callers must have checked the super admin role
// first; this function does not know who is asking.
export const loadUnsentContent = (
  kind: UnsentKind,
  messageId: number,
): Promise<RevealedUnsent | null> =>
  kind === "coach"
    ? loadCoach(messageId)
    : kind === "dm"
      ? loadDm(messageId)
      : loadGroup(messageId);
