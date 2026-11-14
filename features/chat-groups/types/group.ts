import type { SystemEvent } from "@/features/chat-groups/utils/system-event";
import type { AdminRole } from "@/services/admin-scope";

export type GroupRole = "super_admin" | "pt" | "trainee";
export type GroupSenderTag = "manager" | "pt";

// Who is asking, taken from the session by the caller.
export type GroupSession =
  { kind: "user"; id: number } | { kind: "admin"; id: number; role: AdminRole };

export interface GroupActor {
  // "user:<id>" | "admin:<id>", the member key.
  key: string;
  kind: "user" | "admin";
  id: number;
  role: GroupRole;
  isMember: boolean;
  // Super admin, or the PT recorded in created_by_key.
  canManage: boolean;
  // Super admin or PT member: may send when managers-only is on.
  isManager: boolean;
  isSuperAdmin: boolean;
}

export interface GroupReactionView {
  emoji: string;
  count: number;
  mine: boolean;
}

export interface GroupMessageView {
  id: number;
  groupId: number;
  kind: "message" | "system";
  senderKey: string | null;
  // Alias of the viewer first, else the real name; null = deleted account
  // (the UI shows "Deleted member").
  senderName: string | null;
  senderDeleted: boolean;
  senderTag: GroupSenderTag | null;
  // Empty for an unsent or hidden message.
  body: string;
  systemEvent: SystemEvent | null;
  audience: "super_admin" | null;
  clientId: string | null;
  replyTo: { id: number; senderName: string | null; snippet: string } | null;
  sticker: { ref: string; url: string } | null;
  photoId: number | null;
  silent: boolean;
  deleted: boolean;
  hidden: boolean;
  edited: boolean;
  reactions: GroupReactionView[];
  // Members other than the sender who read up to this message; own messages
  // only, 0 otherwise.
  seenCount: number;
  createdAt: Date;
  updatedAt: Date | null;
}

export interface GroupLastMessage {
  id: number;
  kind: "message" | "system";
  senderKey: string | null;
  preview: string;
  systemEvent: SystemEvent | null;
  createdAt: Date;
}

export interface GroupSummary {
  id: number;
  name: string;
  avatarVersion: number | null;
  managersOnly: boolean;
  muted: boolean;
  unread: number;
  canManage: boolean;
  dissolved: boolean;
  lastMessage: GroupLastMessage | null;
  lastMessageAt: Date | null;
}

export interface GroupMemberView {
  key: string;
  kind: "user" | "admin";
  id: number;
  role: GroupRole;
  name: string;
  isCreator: boolean;
}
