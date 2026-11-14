import type { ThreadSnapshot } from "@/features/chat/hooks/use-chat-messages";
import {
  serializeMessage,
  type ServerChatMessage,
  type ThreadViewer,
} from "@/features/chat/utils/chat-thread-rules";
import { PHOTO_ALT } from "@/features/chat/utils/photo-rules";
import { toChatSticker } from "@/features/chat/utils/sticker-rules";
import type { GroupMessageView } from "@/features/chat-groups/types/group";

// Maps what the group routes and actions return onto the message shape the
// shared thread (useChatMessages, buildThreadItems, MessageBubble) draws. Pure,
// so it is tested without a browser. Dates may be Date (actions) or ISO
// strings (route JSON).

type DateLike = Date | string;

export type GroupMessageWire = Omit<
  GroupMessageView,
  "createdAt" | "updatedAt"
> & { createdAt: DateLike; updatedAt: DateLike | null };

export interface GroupThreadWire {
  messages: GroupMessageWire[];
  hasMore: boolean;
  changes: GroupMessageWire[];
  lastChangeAt: number;
  group: {
    id: number;
    name: string;
    avatarVersion: number | null;
    managersOnly: boolean;
    dissolved: boolean;
  };
}

export const groupPhotoUrl = (groupId: number, photoId: number) =>
  `/api/chat/groups/${groupId}/photos/${photoId}`;

export const groupAvatarUrl = (groupId: number, version: number | null) =>
  version === null ? null : `/api/chat/groups/${groupId}/avatar?v=${version}`;

const keyId = (key: string | null, kind: "admin" | "user") => {
  const [prefix, raw] = (key ?? "").split(":");

  return prefix === kind && /^[1-9]\d*$/.test(raw ?? "") ? Number(raw) : null;
};

// The aggregated chips of a group message as per-reactor entries, which is
// what the chips and my-reaction logic read. Others are anonymous here (the
// server sends counts, not names), so each gets a unique key.
const expandReactions = (view: GroupMessageWire, viewerKey: string) =>
  view.reactions.flatMap((reaction) => {
    const others = Math.max(0, reaction.count - (reaction.mine ? 1 : 0));

    return [
      ...(reaction.mine
        ? [{ emoji: reaction.emoji, reactorKey: viewerKey, reactorName: "" }]
        : []),
      ...Array.from({ length: others }, (_, index) => ({
        emoji: reaction.emoji,
        reactorKey: `other:${view.id}:${reaction.emoji}:${index}`,
        reactorName: "",
      })),
    ];
  });

export const toChatMessage = (
  view: GroupMessageWire,
  viewerKey: string,
): ServerChatMessage => {
  const isSystem = view.kind === "system";
  const adminId = keyId(view.senderKey, "admin");

  return {
    id: view.id,
    senderRole: adminId === null ? "user" : "admin",
    senderAdminId: adminId,
    senderAdminName: adminId === null ? null : view.senderName,
    body: view.body,
    sticker: view.sticker
      ? toChatSticker(view.sticker.ref, view.sticker.url)
      : null,
    photo: view.photo
      ? {
          url: groupPhotoUrl(view.groupId, view.photo.id),
          width: view.photo.width,
          height: view.photo.height,
          alt: PHOTO_ALT,
        }
      : null,
    // System lines have no client id; the row id keeps the key unique.
    clientId: view.clientId ?? `system-${view.id}`,
    createdAt: view.createdAt,
    replyTo: view.replyTo
      ? {
          id: view.replyTo.id,
          body: view.replyTo.snippet,
          senderRole: "user",
          deleted: view.replyTo.unavailable,
          senderKey: view.replyTo.senderKey,
          senderName: view.replyTo.senderName,
          ...(view.replyTo.isSticker ? { isSticker: true } : {}),
          ...(view.replyTo.isPhoto ? { isPhoto: true } : {}),
        }
      : null,
    editedAt: view.edited ? (view.updatedAt ?? view.createdAt) : null,
    deleted: view.deleted,
    updatedAt: view.updatedAt ?? view.createdAt,
    reactions: isSystem ? [] : expandReactions(view, viewerKey),
    senderKey: view.senderKey,
    senderName: view.senderName,
    senderDeleted: view.senderDeleted,
    senderTag: view.senderTag,
    kind: view.kind,
    systemEvent: view.systemEvent,
    eventNames: view.eventNames,
    audience: view.audience,
    hidden: view.hidden,
    seenCount: view.seenCount,
  };
};

export const toSerializedGroupMessage = (
  view: GroupMessageWire,
  viewerKey: string,
) => serializeMessage(toChatMessage(view, viewerKey));

// Who may write right now: managers-only turns trainees into readers, a
// dissolved group is read-only, and `canWriteBase` carries what only the
// server knows about the person (chat switch, restriction).
export const canSendInGroup = ({
  dissolved,
  managersOnly,
  isManager,
  canWriteBase,
}: {
  dissolved: boolean;
  managersOnly: boolean;
  isManager: boolean;
  canWriteBase: boolean;
}) => !dissolved && canWriteBase && (!managersOnly || isManager);

export const groupViewer = (
  key: string,
  name: string,
): Extract<ThreadViewer, { role: "member" }> => ({
  role: "member",
  key,
  name,
});

export const isGroupThreadWire = (value: unknown): value is GroupThreadWire =>
  typeof value === "object" &&
  value !== null &&
  Array.isArray((value as GroupThreadWire).messages) &&
  Array.isArray((value as GroupThreadWire).changes) &&
  typeof (value as GroupThreadWire).hasMore === "boolean" &&
  typeof (value as GroupThreadWire).group === "object" &&
  (value as GroupThreadWire).group !== null;

export interface SendRights {
  viewerKey: string;
  isManager: boolean;
  canWriteBase: boolean;
}

// A route payload as the snapshot the shared hook keeps. `chatEnabled` is the
// group's "can I send" (a hint; every send is re-checked on the server).
export const toThreadSnapshot = (
  payload: GroupThreadWire,
  { viewerKey, isManager, canWriteBase }: SendRights,
): ThreadSnapshot => ({
  messages: payload.messages.map((view) =>
    toSerializedGroupMessage(view, viewerKey),
  ),
  changes: payload.changes.map((view) =>
    toSerializedGroupMessage(view, viewerKey),
  ),
  hasMore: payload.hasMore,
  lastChangeAt: payload.lastChangeAt,
  chatEnabled: canSendInGroup({
    dissolved: payload.group.dissolved,
    managersOnly: payload.group.managersOnly,
    isManager,
    canWriteBase,
  }),
  // The one to one "seen" cursor does not exist in groups.
  peerReadUpTo: 0,
});

export const parseGroupThread = (
  raw: unknown,
  rights: SendRights,
): ThreadSnapshot | null =>
  isGroupThreadWire(raw) ? toThreadSnapshot(raw, rights) : null;
