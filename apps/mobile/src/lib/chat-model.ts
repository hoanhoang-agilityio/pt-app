import type {
  ChatMessageView,
  DmMessageView,
  GroupMessageView,
  GroupSystemEvent,
} from "@pt/contracts";

// One message shape for every conversation (coach chat, group, trainee DM).
// The adapters turn each API view into it; merge and grouping then work the
// same everywhere. Pure: no React, no network.

export type ChatPhotoView = { url: string; width: number; height: number };

export type ChatMsg = {
  // Stable list key: the server id, or the clientId of an unconfirmed bubble.
  key: string;
  id: number | null;
  clientId: string;
  mine: boolean;
  senderName: string | null;
  senderKey: string | null;
  kind: "message" | "system";
  body: string;
  deleted: boolean;
  edited: boolean;
  photos: ChatPhotoView[];
  sticker: { url: string; alt: string; kind: string } | null;
  replyTo: {
    id: number;
    snippet: string;
    senderName: string | null;
    isPhoto: boolean;
    isSticker: boolean;
    unavailable: boolean;
  } | null;
  reactions: { emoji: string; count: number; mine: boolean }[];
  createdAt: string;
  // Group: members who read up to here (own messages only).
  seenCount: number;
  systemEvent: GroupSystemEvent | null;
  eventNames: Record<string, string | null>;
  delivery: "sent" | "sending" | "failed";
};

export type Viewer =
  | { kind: "trainee" }
  | { kind: "admin"; adminId: number }
  | { kind: "member"; key: string };

const base = (): Omit<
  ChatMsg,
  "key" | "id" | "clientId" | "mine" | "createdAt" | "body"
> => ({
  senderName: null,
  senderKey: null,
  kind: "message",
  deleted: false,
  edited: false,
  photos: [],
  sticker: null,
  replyTo: null,
  reactions: [],
  seenCount: 0,
  systemEvent: null,
  eventNames: {},
  delivery: "sent",
});

const photosOf = (view: {
  photo?: ChatPhotoView | null;
  photos?: ChatPhotoView[];
}) =>
  (view.photos && view.photos.length > 0
    ? view.photos
    : view.photo
      ? [view.photo]
      : []
  ).map(({ url, width, height }) => ({ url, width, height }));

// Reactor keys of the coach chat: "user" or "admin:<id>".
export const viewerReactorKey = (viewer: Viewer) =>
  viewer.kind === "trainee"
    ? "user"
    : viewer.kind === "admin"
      ? `admin:${viewer.adminId}`
      : viewer.key;

export const aggregateReactions = (
  reactions: { emoji: string; reactorKey: string }[],
  myKey: string,
) => {
  const byEmoji = new Map<string, { count: number; mine: boolean }>();

  for (const reaction of reactions) {
    const entry = byEmoji.get(reaction.emoji) ?? { count: 0, mine: false };

    entry.count += 1;
    entry.mine ||= reaction.reactorKey === myKey;
    byEmoji.set(reaction.emoji, entry);
  }
  return [...byEmoji.entries()]
    .map(([emoji, value]) => ({ emoji, ...value }))
    .sort((a, b) => b.count - a.count);
};

export const fromCoachMessage = (
  message: ChatMessageView,
  viewer: Viewer,
): ChatMsg => {
  const mine =
    viewer.kind === "trainee"
      ? message.senderRole === "user"
      : viewer.kind === "admin"
        ? message.senderRole === "admin" &&
          message.senderAdminId === viewer.adminId
        : false;

  return {
    ...base(),
    key: String(message.id),
    id: message.id,
    clientId: message.clientId,
    mine,
    senderName: message.senderRole === "admin" ? message.senderAdminName : null,
    senderKey:
      message.senderRole === "admin" ? `admin:${message.senderAdminId}` : "user",
    body: message.body,
    deleted: message.deleted,
    edited: message.editedAt !== null,
    photos: photosOf(message),
    sticker: message.sticker,
    replyTo: message.replyTo
      ? {
          id: message.replyTo.id,
          snippet: message.replyTo.body,
          senderName: null,
          isPhoto: message.replyTo.isPhoto,
          isSticker: message.replyTo.isSticker,
          unavailable: message.replyTo.deleted,
        }
      : null,
    reactions: aggregateReactions(message.reactions, viewerReactorKey(viewer)),
    createdAt: message.createdAt,
  };
};

export const fromGroupMessage = (
  message: GroupMessageView,
  viewerKey: string,
): ChatMsg => ({
  ...base(),
  key: String(message.id),
  id: message.id,
  clientId: message.clientId ?? `g${message.id}`,
  mine: message.senderKey !== null && message.senderKey === viewerKey,
  senderName: message.senderDeleted ? null : message.senderName,
  senderKey: message.senderKey,
  kind: message.kind,
  body: message.hidden ? "" : message.body,
  deleted: message.deleted || message.hidden,
  edited: message.edited,
  photos: photosOf(message),
  sticker: message.sticker,
  replyTo: message.replyTo
    ? {
        id: message.replyTo.id,
        snippet: message.replyTo.snippet,
        senderName: message.replyTo.senderName,
        isPhoto: message.replyTo.isPhoto,
        isSticker: message.replyTo.isSticker,
        unavailable: message.replyTo.unavailable,
      }
    : null,
  reactions: message.reactions,
  createdAt: message.createdAt,
  seenCount: message.seenCount,
  systemEvent: message.systemEvent,
  eventNames: message.eventNames,
});

export const fromDmMessage = (
  message: DmMessageView,
  myUserId: number,
): ChatMsg => ({
  ...base(),
  key: String(message.id),
  id: message.id,
  clientId: message.clientId,
  mine: message.senderId === myUserId,
  senderKey: `user:${message.senderId}`,
  body: message.body ?? "",
  photos: photosOf(message),
  createdAt: message.createdAt,
});

// An own bubble shown before the server confirms it.
export const optimisticMessage = (input: {
  clientId: string;
  body: string;
  photos?: ChatPhotoView[];
  replyTo?: ChatMsg["replyTo"];
  now?: Date;
}): ChatMsg => ({
  ...base(),
  key: input.clientId,
  id: null,
  clientId: input.clientId,
  mine: true,
  body: input.body,
  photos: input.photos ?? [],
  replyTo: input.replyTo ?? null,
  createdAt: (input.now ?? new Date()).toISOString(),
  delivery: "sending",
});

const compare = (a: ChatMsg, b: ChatMsg) => {
  if (a.id !== null && b.id !== null) {
    return a.id - b.id;
  }
  if (a.id === null && b.id === null) {
    return Date.parse(a.createdAt) - Date.parse(b.createdAt);
  }
  // Unconfirmed bubbles always sit after stored messages.
  return a.id === null ? 1 : -1;
};

// Folds server messages into the list: a stored message replaces the
// optimistic bubble with the same clientId; the same id never appears twice.
export const mergeMessages = (current: ChatMsg[], incoming: ChatMsg[]) => {
  const byId = new Map<number, ChatMsg>();
  const pending = new Map<string, ChatMsg>();

  for (const message of current) {
    if (message.id === null) {
      pending.set(message.clientId, message);
    } else {
      byId.set(message.id, message);
    }
  }
  for (const message of incoming) {
    if (message.id === null) {
      continue;
    }
    byId.set(message.id, message);
    pending.delete(message.clientId);
  }
  return [...byId.values(), ...pending.values()].sort(compare);
};

// Folds changed messages (edit, unsend, reaction) in place. An id that is not
// loaded is skipped: adding it would leave a gap.
export const mergeChanges = (current: ChatMsg[], changes: ChatMsg[]) => {
  if (changes.length === 0) {
    return current;
  }
  const byId = new Map(changes.map((change) => [change.id, change]));

  return current.map((message) =>
    message.id === null ? message : (byId.get(message.id) ?? message),
  );
};

export const lastStoredId = (messages: ChatMsg[]) =>
  messages.reduce((last, m) => (m.id !== null && m.id > last ? m.id : last), 0);

export const firstStoredId = (messages: ChatMsg[]) =>
  messages.find((m) => m.id !== null)?.id ?? null;

// What "read" is reported against: the newest stored message from someone else
// (system lines never count).
export const newestIncomingId = (messages: ChatMsg[]) =>
  messages.reduce(
    (newest, m) =>
      m.id !== null && !m.mine && m.kind !== "system" && m.id > newest
        ? m.id
        : newest,
    0,
  );

// "Đã xem" goes under the newest own message the other side has read.
export const lastSeenOwnId = (messages: ChatMsg[], peerReadUpTo: number) => {
  let found: number | null = null;

  for (const m of messages) {
    if (m.mine && m.id !== null && m.id <= peerReadUpTo && !m.deleted) {
      found = m.id;
    }
  }
  return found;
};

// ---- Grouping for the list ------------------------------------------------

// A time stamp appears after a pause longer than this.
export const GROUP_GAP_MS = 30 * 60 * 1000;

export type ThreadRow =
  | { type: "day"; key: string; at: string }
  | {
      type: "message";
      key: string;
      message: ChatMsg;
      // First / last bubble of a run by the same sender (rounded corners,
      // name and avatar only on the last/first).
      isFirstInRun: boolean;
      isLastInRun: boolean;
      showTime: boolean;
    };

export const isSameLocalDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

// Oldest first, with a day separator before the first message of each day and
// runs of one sender split by a pause above GROUP_GAP_MS.
export const buildRows = (messages: ChatMsg[]): ThreadRow[] => {
  const rows: ThreadRow[] = [];
  let previous: ChatMsg | null = null;

  messages.forEach((message, index) => {
    const at = new Date(message.createdAt);
    const prevAt = previous ? new Date(previous.createdAt) : null;
    const newDay = !prevAt || !isSameLocalDay(prevAt, at);

    if (newDay) {
      rows.push({ type: "day", key: `day-${message.key}`, at: message.createdAt });
    }
    const gap = prevAt ? at.getTime() - prevAt.getTime() > GROUP_GAP_MS : true;
    const sameRun =
      !newDay &&
      !gap &&
      previous !== null &&
      previous.kind === "message" &&
      message.kind === "message" &&
      previous.senderKey === message.senderKey &&
      previous.mine === message.mine;
    const next = messages[index + 1];
    const nextAt = next ? new Date(next.createdAt) : null;
    const nextSame =
      next !== undefined &&
      nextAt !== null &&
      isSameLocalDay(at, nextAt) &&
      nextAt.getTime() - at.getTime() <= GROUP_GAP_MS &&
      next.kind === "message" &&
      message.kind === "message" &&
      next.senderKey === message.senderKey &&
      next.mine === message.mine;

    rows.push({
      type: "message",
      key: message.key,
      message,
      isFirstInRun: !sameRun,
      isLastInRun: !nextSame,
      showTime: !nextSame,
    });
    previous = message;
  });
  return rows;
};

// Preview text for the inbox or a reply quote when the message has no text.
export const hasContent = (message: ChatMsg) =>
  message.body !== "" || message.photos.length > 0 || message.sticker !== null;
