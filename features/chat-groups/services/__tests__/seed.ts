import { eq } from "drizzle-orm";

import type { TestDb } from "@/db/__tests__/create-test-db";
import {
  admins,
  chatGroupMembers,
  chatGroupMessages,
  chatGroups,
  users,
} from "@/db/schema";

// Rows for the group chat tests. Everything is inserted straight into the
// in-memory database, so a test states exactly the world it needs.

export const seedAdmin = async (
  db: TestDb,
  name: string,
  role: "super_admin" | "pt" | null,
  createdAt?: Date,
) => {
  const [row] = await db
    .insert(admins)
    .values({
      username: name,
      usernameKey: name.toLowerCase(),
      passwordHash: "x",
      role,
      ...(createdAt ? { createdAt } : {}),
    })
    .returning({ id: admins.id });

  return row.id;
};

export const seedUser = async (
  db: TestDb,
  name: string,
  {
    chatEnabled = true,
    ptAdminId = null,
  }: { chatEnabled?: boolean | null; ptAdminId?: number | null } = {},
) => {
  const [row] = await db
    .insert(users)
    .values({ name, nameKey: name.toLowerCase(), chatEnabled, ptAdminId })
    .returning({ id: users.id });

  return row.id;
};

export const seedGroup = async (
  db: TestDb,
  {
    createdByKey,
    name = "Lớp sáng",
    members = [],
    managersOnly = null,
    dissolved = false,
  }: {
    createdByKey: string;
    name?: string;
    members?: string[];
    managersOnly?: boolean | null;
    dissolved?: boolean;
  },
) => {
  const now = new Date();
  const [group] = await db
    .insert(chatGroups)
    .values({
      name,
      createdByKey,
      managersOnly,
      dissolvedAt: dissolved ? now : null,
      createdAt: now,
    })
    .returning({ id: chatGroups.id });

  for (const memberKey of members) {
    await db.insert(chatGroupMembers).values({
      groupId: group.id,
      memberKey,
      addedByKey: createdByKey,
      joinedAt: now,
    });
  }
  return group.id;
};

let clock = Date.UTC(2026, 10, 10);

export const seedMessage = async (
  db: TestDb,
  groupId: number,
  senderKey: string | null,
  body: string,
  extra: Partial<typeof chatGroupMessages.$inferInsert> = {},
) => {
  clock += 1000;
  const createdAt = new Date(clock);
  const [row] = await db
    .insert(chatGroupMessages)
    .values({
      groupId,
      kind: senderKey ? "message" : "system",
      senderKey,
      body,
      clientId: senderKey ? crypto.randomUUID() : null,
      createdAt,
      ...extra,
    })
    .returning({ id: chatGroupMessages.id });

  if (!extra.audience) {
    await db
      .update(chatGroups)
      .set({ lastMessageId: row.id, lastMessageAt: createdAt })
      .where(eq(chatGroups.id, groupId));
  }
  return row.id;
};
