import { Injectable } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import {
  CHAT_USER_READER_KEY,
  chatAdminReaderKey,
  type GroupSession,
} from "@pt/contracts";
import { DataSource } from "typeorm";

import type { AuthActor } from "../auth/actor.js";
import { GroupQueries } from "../chat-groups/group.queries.js";
import { DmQueries } from "../dm/dm.queries.js";
import { NotificationsService } from "../social/notifications/notifications.service.js";
import { ChatQueries } from "./chat.queries.js";

// Unread numbers a caller already has; a missing one is queried.
export type KnownUnread = { chat?: number; dm?: number };

export type AppBadgeParts = {
  // The coach chat: a trainee's unread from their PT, an admin's unread across
  // their trainees.
  chat: number;
  // Trainee-to-trainee chats (admins have none).
  dm: number;
  groups: number;
  // Unread social notifications (the bell).
  notifications: number;
};

// The number on the app icon: everything unread for one person.
export const sumAppBadge = (parts: AppBadgeParts) =>
  Math.max(0, parts.chat + parts.dm + parts.groups + parts.notifications);

const sessionOf = (
  kind: "user" | "admin",
  id: number,
  role: "super_admin" | "pt" | null,
): GroupSession =>
  kind === "user"
    ? { kind: "user", id }
    : { kind: "admin", id, role: role ?? "pt" };

// Unread coach chat + trainee DMs + group messages + unread social
// notifications for one trainee or admin. The chat, DM and group parts use the
// same queries as their own badge polls, so the numbers always agree.
@Injectable()
export class AppBadgeService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly chat: ChatQueries,
    private readonly dm: DmQueries,
    private readonly groups: GroupQueries,
    private readonly notifications: NotificationsService,
  ) {}

  // `known` carries the chat and DM numbers a caller already computed (the
  // unread poll has them), so only groups and notifications are queried.
  forActor(actor: AuthActor, known?: KnownUnread) {
    return actor.kind === "user"
      ? this.forTrainee(actor.id, known)
      : this.forAdmin(actor.id, actor.role, known);
  }

  // A push owner key: `user:<id>` or `admin:<id>`; anything else counts 0.
  async forOwnerKey(ownerKey: string) {
    const [kind, rawId] = ownerKey.split(":");
    const id = Number(rawId);

    if (!Number.isInteger(id) || id <= 0) {
      return 0;
    }
    if (kind === "user") {
      return this.forTrainee(id);
    }
    if (kind === "admin") {
      const rows: { role: "super_admin" | "pt" }[] =
        await this.dataSource.query(`SELECT role FROM admins WHERE id = $1`, [
          id,
        ]);

      return rows[0] ? this.forAdmin(id, rows[0].role) : 0;
    }
    return 0;
  }

  async forTrainee(userId: number, known?: KnownUnread) {
    const [chat, dm, groups, notifications] = await Promise.all([
      known?.chat ?? this.traineeChat(userId),
      known?.dm ?? this.dm.countUnread(userId),
      this.groupUnread(sessionOf("user", userId, null)),
      this.notifications.unreadCount(`user:${userId}`),
    ]);

    return sumAppBadge({ chat, dm, groups, notifications });
  }

  async forAdmin(
    adminId: number,
    role: "super_admin" | "pt",
    known?: KnownUnread,
  ) {
    const [chat, groups, notifications] = await Promise.all([
      known?.chat ?? this.adminChat(adminId),
      this.groupUnread(sessionOf("admin", adminId, role)),
      this.notifications.unreadCount(`admin:${adminId}`),
    ]);

    return sumAppBadge({ chat, dm: 0, groups, notifications });
  }

  private async traineeChat(userId: number) {
    const conversation = await this.chat.findConversationByUserId(userId);

    if (!conversation) {
      return 0;
    }
    const rows = await this.chat.unreadByConversation(
      "admin",
      CHAT_USER_READER_KEY,
      { conversationId: conversation.id },
    );

    return rows[0]?.unread ?? 0;
  }

  private async adminChat(adminId: number) {
    const rows = await this.chat.unreadByConversation(
      "user",
      chatAdminReaderKey(adminId),
      { adminId },
    );

    return rows.reduce((total, row) => total + row.unread, 0);
  }

  private async groupUnread(session: GroupSession) {
    const groups = await this.groups.visibleGroups(session);
    const unread = await this.groups.unreadByGroup(
      session,
      groups.map((group) => group.id),
    );

    return [...unread.values()].reduce((total, count) => total + count, 0);
  }
}
