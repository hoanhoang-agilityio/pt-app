// Unread and seen-by rules that need no database. The SQL in group-queries
// applies the same predicate; the tests keep the two in step.

export interface UnreadCandidate {
  id: number;
  kind: "message" | "system";
  senderKey: string | null;
  audience: "super_admin" | null;
  deletedAt: Date | null;
  hiddenAt: Date | null;
  createdAt: Date;
}

export interface UnreadViewer {
  key: string;
  lastReadMessageId: number;
  // Super admins only: messages before the account existed never count.
  baselineAt?: Date | null;
}

// Unread excludes own messages, system lines (alerts included), unsent and
// hidden messages. Muting does not change it.
export const isUnreadFor = (
  message: UnreadCandidate,
  viewer: UnreadViewer,
): boolean =>
  message.id > viewer.lastReadMessageId &&
  message.kind === "message" &&
  message.senderKey !== viewer.key &&
  message.audience === null &&
  message.deletedAt === null &&
  message.hiddenAt === null &&
  (!viewer.baselineAt ||
    message.createdAt.getTime() >= viewer.baselineAt.getTime());

export const countUnreadFor = (
  messages: UnreadCandidate[],
  viewer: UnreadViewer,
) => messages.filter((message) => isUnreadFor(message, viewer)).length;

export interface ReaderCursor {
  memberKey: string;
  lastReadMessageId: number;
}

// Members other than the sender whose cursor is at or past the message.
export const seenByKeys = (
  message: { id: number; senderKey: string | null },
  cursors: ReaderCursor[],
): string[] =>
  cursors
    .filter(
      (cursor) =>
        cursor.memberKey !== message.senderKey &&
        cursor.lastReadMessageId >= message.id,
    )
    .map((cursor) => cursor.memberKey);
