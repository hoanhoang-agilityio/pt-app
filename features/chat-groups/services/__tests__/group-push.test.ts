import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createTestDb, type TestDb } from "@/db/__tests__/create-test-db";
import {
  admins,
  chatGroupMembers,
  pushSubscriptions,
  users,
} from "@/db/schema";
import {
  seedAdmin,
  seedGroup,
  seedUser,
} from "@/features/chat-groups/services/__tests__/seed";

const state = vi.hoisted(() => ({ db: null as unknown }));

vi.mock("server-only", () => ({}));
vi.mock("web-push", () => ({ default: { sendNotification: vi.fn() } }));
vi.mock("@/db", () => ({
  db: new Proxy(
    {},
    { get: (_target, property) => Reflect.get(state.db as object, property) },
  ),
}));

const push = await import("@/features/chat-groups/services/group-push");
const chatPush = await import("@/features/chat/services/chat-push");

let db: TestDb;
let superId: number;
let mutedSuperId: number;
let ptId: number;
let anId: number;
let binhId: number;
let groupId: number;

const addSub = (ownerKey: string) =>
  db.insert(pushSubscriptions).values({
    ownerKey,
    endpoint: `https://push.example/${ownerKey.replace(":", "-")}`,
    p256dh: "p",
    auth: "a",
  });

beforeEach(async () => {
  vi.restoreAllMocks();
  db = await createTestDb();
  state.db = db;
  chatPush.resetChatPushForTests();
  vi.stubEnv("VAPID_PUBLIC_KEY", "pub");
  vi.stubEnv("NEXT_PUBLIC_VAPID_PUBLIC_KEY", "");
  vi.stubEnv("VAPID_PRIVATE_KEY", "priv");
  vi.stubEnv("VAPID_SUBJECT", "mailto:pt@example.com");
  vi.spyOn(console, "error").mockImplementation(() => {});
  superId = await seedAdmin(db, "Boss", null);
  mutedSuperId = await seedAdmin(db, "Quiet", "super_admin");
  ptId = await seedAdmin(db, "Coach", "pt");
  anId = await seedUser(db, "An");
  binhId = await seedUser(db, "Binh");
  groupId = await seedGroup(db, {
    createdByKey: `admin:${ptId}`,
    name: "Lớp sáng",
    members: [`admin:${ptId}`, `user:${anId}`, `user:${binhId}`],
  });
  // A super admin mutes through a lazily created state row.
  await db.insert(chatGroupMembers).values({
    groupId,
    memberKey: `admin:${mutedSuperId}`,
    addedByKey: `admin:${mutedSuperId}`,
    joinedAt: new Date(),
    mutedAt: new Date(),
  });
});

describe("listGroupPushRecipients", () => {
  it("includes members and implicit super admins, minus the sender and the muted", async () => {
    await db
      .update(chatGroupMembers)
      .set({ mutedAt: new Date() })
      .where(eq(chatGroupMembers.memberKey, `user:${binhId}`));

    expect(await push.listGroupPushRecipients(groupId, `user:${anId}`)).toEqual(
      [`admin:${ptId}`, `admin:${superId}`].sort(),
    );
  });

  it("never includes a member who left or was removed, nor the muted super admin", async () => {
    await db
      .update(chatGroupMembers)
      .set({ leftAt: new Date() })
      .where(eq(chatGroupMembers.memberKey, `user:${binhId}`));
    const keys = await push.listGroupPushRecipients(groupId, `admin:${ptId}`);

    expect(keys).toEqual([`admin:${superId}`, `user:${anId}`].sort());
    expect(keys).not.toContain(`admin:${mutedSuperId}`);
  });

  it("includes an unmuted super admin even without any row", async () => {
    expect(
      await push.listGroupPushRecipients(groupId, `admin:${ptId}`),
    ).toContain(`admin:${superId}`);
  });
});

describe("sendGroupPush", () => {
  const sendAndCollect = async (
    input: Partial<Parameters<typeof push.sendGroupPush>[0]> = {},
  ) => {
    const sender = vi.fn(async () => {});

    await push.sendGroupPush(
      { groupId, senderKey: `user:${anId}`, body: "Chào cả nhóm", ...input },
      sender,
    );
    return sender.mock.calls as unknown as [
      { endpoint: string },
      { title: string; body: string; url: string; tag: string },
    ][];
  };

  it("notifies the right devices with the user and admin deep links", async () => {
    await addSub(`user:${anId}`);
    await addSub(`user:${binhId}`);
    await addSub(`admin:${ptId}`);
    await addSub(`admin:${superId}`);
    await addSub(`admin:${mutedSuperId}`);
    const calls = await sendAndCollect();
    const byEndpoint = Object.fromEntries(
      calls.map(([sub, payload]) => [
        sub.endpoint.replace("https://push.example/", ""),
        payload,
      ]),
    );

    expect(Object.keys(byEndpoint).sort()).toEqual(
      [`user-${binhId}`, `admin-${ptId}`, `admin-${superId}`].sort(),
    );
    expect(byEndpoint[`user-${binhId}`]).toEqual({
      title: "Lớp sáng",
      body: "An: Chào cả nhóm",
      url: `/messages/groups/${groupId}`,
      tag: `chat-group-${groupId}`,
    });
    expect(byEndpoint[`admin-${superId}`].url).toBe(
      `/admin/messages/groups/${groupId}`,
    );
    expect(byEndpoint[`admin-${ptId}`].url).toBe(
      `/admin/messages/groups/${groupId}`,
    );
  });

  it("uses a kind label for photos and stickers instead of text", async () => {
    await addSub(`user:${binhId}`);

    expect((await sendAndCollect({ photo: true }))[0][1].body).toBe(
      "An: Đã gửi ảnh",
    );
    expect((await sendAndCollect({ sticker: true }))[0][1].body).toBe(
      "An: Đã gửi sticker",
    );
  });

  it("builds each push in the recipient's language", async () => {
    await addSub(`user:${binhId}`);
    await addSub(`admin:${ptId}`);
    await db.update(users).set({ locale: "en" }).where(eq(users.id, binhId));
    await db.update(admins).set({ locale: "zh" }).where(eq(admins.id, ptId));
    const bodies = Object.fromEntries(
      (await sendAndCollect({ photo: true })).map(([sub, payload]) => [
        sub.endpoint.replace("https://push.example/", ""),
        payload.body,
      ]),
    );

    expect(bodies[`user-${binhId}`]).toBe("An: Sent a photo");
    expect(bodies[`admin-${ptId}`]).not.toBe(bodies[`user-${binhId}`]);
    expect(bodies[`admin-${ptId}`]).toMatch(/^An: .*[一-鿿]/);
  });

  it("sends nothing to a removed trainee, a dissolved group or an unknown group", async () => {
    await addSub(`user:${binhId}`);
    await db
      .update(chatGroupMembers)
      .set({ leftAt: new Date(), removedByKey: `admin:${ptId}` })
      .where(eq(chatGroupMembers.memberKey, `user:${binhId}`));
    expect(await sendAndCollect()).toHaveLength(0);

    await db
      .update(chatGroupMembers)
      .set({ leftAt: null })
      .where(eq(chatGroupMembers.memberKey, `user:${binhId}`));
    expect(await sendAndCollect()).toHaveLength(1);
    expect(await sendAndCollect({ groupId: 9999 })).toHaveLength(0);
    const { chatGroups } = await import("@/db/schema");

    await db.update(chatGroups).set({ dissolvedAt: new Date() });
    expect(await sendAndCollect()).toHaveLength(0);
  });

  it("drops a dead subscription and never logs the message text", async () => {
    await addSub(`user:${binhId}`);
    await addSub(`admin:${ptId}`);
    const errorSpy = vi.spyOn(console, "error");
    const sender = vi.fn(async (sub: { endpoint: string }) => {
      if (sub.endpoint.endsWith(`user-${binhId}`)) {
        throw Object.assign(new Error("gone"), { statusCode: 410 });
      }
      if (sub.endpoint.endsWith(`admin-${ptId}`)) {
        throw Object.assign(new Error("boom"), { statusCode: 500 });
      }
    });

    await push.sendGroupPush(
      { groupId, senderKey: `user:${anId}`, body: "SECRET-TEXT" },
      sender,
    );
    expect(
      (await db.select().from(pushSubscriptions)).map((r) => r.ownerKey),
    ).toEqual([`admin:${ptId}`]);
    expect(JSON.stringify(errorSpy.mock.calls)).not.toContain("SECRET-TEXT");
  });

  it("does nothing without VAPID keys", async () => {
    vi.stubEnv("VAPID_PUBLIC_KEY", "");
    vi.stubEnv("VAPID_PRIVATE_KEY", "");
    await addSub(`user:${binhId}`);

    expect(await sendAndCollect()).toHaveLength(0);
  });
});
