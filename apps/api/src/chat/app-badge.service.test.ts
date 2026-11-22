import type { DataSource } from "typeorm";
import { describe, expect, it, vi } from "vitest";

import type { GroupQueries } from "../chat-groups/group.queries.js";
import type { DmQueries } from "../dm/dm.queries.js";
import type { NotificationsService } from "../social/notifications/notifications.service.js";
import { AppBadgeService, sumAppBadge } from "./app-badge.service.js";
import type { ChatQueries } from "./chat.queries.js";

const build = (
  options: {
    coach?: number;
    adminChat?: number[];
    dm?: number;
    groups?: Record<number, number>;
    notifications?: number;
    role?: "super_admin" | "pt" | null;
  } = {},
) => {
  const chat = {
    findConversationByUserId: vi.fn().mockResolvedValue({ id: 5 }),
    unreadByConversation: vi.fn(
      async (sender: "user" | "admin") =>
        sender === "admin"
          ? [{ conversationId: 5, unread: options.coach ?? 0 }]
          : (options.adminChat ?? []).map((unread, i) => ({
              conversationId: i + 1,
              unread,
            })),
    ),
  };
  const dm = { countUnread: vi.fn().mockResolvedValue(options.dm ?? 0) };
  const groups = {
    visibleGroups: vi
      .fn()
      .mockResolvedValue(
        Object.keys(options.groups ?? {}).map((id) => ({ id: Number(id) })),
      ),
    unreadByGroup: vi.fn(
      async () => new Map(Object.entries(options.groups ?? {}).map(([k, v]) => [Number(k), v])),
    ),
  };
  const notifications = {
    unreadCount: vi.fn().mockResolvedValue(options.notifications ?? 0),
  };
  const dataSource = {
    query: vi
      .fn()
      .mockResolvedValue(options.role === null ? [] : [{ role: options.role ?? "pt" }]),
  };
  const service = new AppBadgeService(
    dataSource as unknown as DataSource,
    chat as unknown as ChatQueries,
    dm as unknown as DmQueries,
    groups as unknown as GroupQueries,
    notifications as unknown as NotificationsService,
  );

  return { service, chat, dm, groups, notifications };
};

describe("sumAppBadge", () => {
  it("adds the four parts and never goes below 0", () => {
    expect(
      sumAppBadge({ chat: 1, dm: 2, groups: 3, notifications: 4 }),
    ).toBe(10);
    expect(sumAppBadge({ chat: 0, dm: 0, groups: 0, notifications: 0 })).toBe(0);
    expect(sumAppBadge({ chat: -3, dm: 0, groups: 0, notifications: 0 })).toBe(0);
  });
});

describe("AppBadgeService", () => {
  it("sums coach chat, DMs, every group and unread notifications for a trainee", async () => {
    const { service, notifications } = build({
      coach: 2,
      dm: 3,
      groups: { 1: 4, 2: 5 },
      notifications: 6,
    });

    expect(await service.forTrainee(9)).toBe(2 + 3 + 9 + 6);
    expect(notifications.unreadCount).toHaveBeenCalledWith("user:9");
  });

  it("is 0 for a trainee without a conversation, groups or notifications", async () => {
    const { service, chat } = build();

    chat.findConversationByUserId.mockResolvedValue(null);
    expect(await service.forTrainee(9)).toBe(0);
  });

  it("sums the unread of every trainee, groups and notifications for an admin, without DMs", async () => {
    const { service, dm, notifications, groups } = build({
      adminChat: [1, 2],
      dm: 99,
      groups: { 7: 3 },
      notifications: 4,
    });

    expect(await service.forAdmin(3, "pt")).toBe(1 + 2 + 3 + 4);
    expect(dm.countUnread).not.toHaveBeenCalled();
    expect(notifications.unreadCount).toHaveBeenCalledWith("admin:3");
    expect(groups.visibleGroups).toHaveBeenCalledWith({
      kind: "admin",
      id: 3,
      role: "pt",
    });
  });

  it("reads a push owner key, and counts 0 for a malformed or unknown owner", async () => {
    const { service } = build({ coach: 1, notifications: 1 });

    expect(await service.forOwnerKey("user:9")).toBe(2);
    expect(await service.forOwnerKey("admin:3")).toBe(1);
    expect(await service.forOwnerKey("admin:abc")).toBe(0);
    expect(await service.forOwnerKey("robot:1")).toBe(0);
    expect(await service.forOwnerKey("user:0")).toBe(0);
    expect(await build({ role: null }).service.forOwnerKey("admin:3")).toBe(0);
  });
});
