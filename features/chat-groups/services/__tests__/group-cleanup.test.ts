import { beforeEach, describe, expect, it, vi } from "vitest";

import { createTestDb, type TestDb } from "@/db/__tests__/create-test-db";
import {
  chatGroupMembers,
  chatGroupMessages,
  chatGroupPhotos,
  chatGroupReactions,
} from "@/db/schema";
import {
  seedAdmin,
  seedGroup,
  seedMessage,
  seedUser,
} from "@/features/chat-groups/services/__tests__/seed";

const state = vi.hoisted(() => ({ db: null as unknown }));

vi.mock("server-only", () => ({}));
vi.mock("@/db", () => ({
  db: new Proxy(
    {},
    { get: (_target, property) => Reflect.get(state.db as object, property) },
  ),
}));

const cleanup = await import("@/features/chat-groups/services/group-cleanup");
const queries = await import("@/features/chat-groups/services/group-queries");
const access = await import("@/features/chat-groups/services/group-access");

let db: TestDb;
let ptId: number;
let anId: number;
let binhId: number;
let groupId: number;
let anMessage: number;

const photo = (uploaderKey: string, messageId: number | null) =>
  db.insert(chatGroupPhotos).values({
    groupId,
    messageId,
    uploaderKey,
    mime: "image/webp",
    width: 1,
    height: 1,
    data: Buffer.from([1]),
    size: 1,
    createdAt: new Date(),
  });

beforeEach(async () => {
  db = await createTestDb();
  state.db = db;
  ptId = await seedAdmin(db, "Coach", "pt");
  anId = await seedUser(db, "An");
  binhId = await seedUser(db, "Binh");
  groupId = await seedGroup(db, {
    createdByKey: `admin:${ptId}`,
    members: [`admin:${ptId}`, `user:${anId}`, `user:${binhId}`],
  });
  anMessage = await seedMessage(db, groupId, `user:${anId}`, "tin của An");
  await seedMessage(db, groupId, `admin:${ptId}`, "tin của PT");
  await db.insert(chatGroupReactions).values([
    {
      messageId: anMessage,
      reactorKey: `user:${anId}`,
      emoji: "💪",
      createdAt: new Date(),
    },
    {
      messageId: anMessage,
      reactorKey: `user:${binhId}`,
      emoji: "💪",
      createdAt: new Date(),
    },
    {
      messageId: anMessage,
      reactorKey: `admin:${ptId}`,
      emoji: "👍",
      createdAt: new Date(),
    },
  ]);
  await photo(`user:${anId}`, null);
  await photo(`user:${anId}`, anMessage);
  await photo(`user:${binhId}`, null);
});

describe("removeUserFromGroups", () => {
  it("removes the trainee's member rows, reactions and pending photos only", async () => {
    await db.transaction((tx) => cleanup.removeUserFromGroups(tx, anId));

    expect(
      (await db.select().from(chatGroupMembers)).map((r) => r.memberKey).sort(),
    ).toEqual([`admin:${ptId}`, `user:${binhId}`].sort());
    expect(
      (await db.select().from(chatGroupReactions))
        .map((r) => r.reactorKey)
        .sort(),
    ).toEqual([`admin:${ptId}`, `user:${binhId}`].sort());
    const photos = await db.select().from(chatGroupPhotos);

    expect(photos.map((p) => [p.uploaderKey, p.messageId])).toEqual([
      [`user:${anId}`, anMessage],
      [`user:${binhId}`, null],
    ]);
  });

  it("keeps the messages, which then show as a deleted member", async () => {
    await db.transaction((tx) => cleanup.removeUserFromGroups(tx, anId));
    // The member delete removes the account itself right after.
    const { users } = await import("@/db/schema");
    const { eq } = await import("drizzle-orm");

    await db.delete(users).where(eq(users.id, anId));
    expect(await db.select().from(chatGroupMessages)).toHaveLength(2);
    const actor = (await access.loadGroupActor(
      groupId,
      access.sessionOfUser({ id: binhId }),
    ))!.actor;
    const { messages } = await queries.listGroupMessages(groupId, actor);

    expect(messages[0]).toMatchObject({
      body: "tin của An",
      senderName: null,
      senderDeleted: true,
    });
    // And nobody can reach the group as the deleted trainee any more.
    expect(
      await access.loadGroupActor(groupId, access.sessionOfUser({ id: anId })),
    ).toBeNull();
  });
});

describe("removeAdminFromGroups", () => {
  it("removes the PT's member and state rows and keeps their messages and the group", async () => {
    await db.transaction((tx) => cleanup.removeAdminFromGroups(tx, ptId));

    expect(
      (await db.select().from(chatGroupMembers)).map((r) => r.memberKey).sort(),
    ).toEqual([`user:${anId}`, `user:${binhId}`].sort());
    expect(
      (await db.select().from(chatGroupReactions)).map((r) => r.reactorKey),
    ).not.toContain(`admin:${ptId}`);
    expect(await db.select().from(chatGroupMessages)).toHaveLength(2);
  });
});
