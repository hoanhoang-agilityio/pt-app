import { beforeEach, describe, expect, it, vi } from "vitest";

import { createTestDb, type TestDb } from "@/db/__tests__/create-test-db";
import { admins, chatMutes, pushSubscriptions, users } from "@/db/schema";

const state = vi.hoisted(() => ({ db: null as unknown }));

vi.mock("server-only", () => ({}));
vi.mock("web-push", () => ({ default: { sendNotification: vi.fn() } }));
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  after: (work: () => unknown) => void work(),
}));
vi.mock("@/features/chat/services/chat-realtime", () => ({
  publishChatEvent: vi.fn(async () => undefined),
}));
vi.mock("@/db", () => ({
  db: new Proxy(
    {},
    { get: (_target, property) => Reflect.get(state.db as object, property) },
  ),
}));

const mutes = await import("@/features/chat/services/chat-mutes");
const q = await import("@/features/chat/services/chat-queries");
const push = await import("@/features/chat/services/chat-push");
const dm = await import("@/features/social/services/dm-notify");

type Sender = import("@/features/chat/services/chat-push").PushSender;

let db: TestDb;
let seq = 0;
const A = 1;
const B = 2;
const NOW = new Date("2026-11-28T10:00:00Z");
const HOUR = 3_600_000;

const addTrainee = async (name: string) => {
  const [row] = await db
    .insert(users)
    .values({ name, nameKey: name.toLowerCase(), chatEnabled: true })
    .returning({ id: users.id });
  const conversation = await q.getOrCreateConversation(row.id);

  return { userId: row.id, conversationId: conversation.id };
};

const fromTrainee = (conversationId: number) =>
  q.insertMessage({
    conversationId,
    senderRole: "user",
    senderAdminId: null,
    body: "hi",
    clientId: `00000000-0000-4000-8000-${String(++seq).padStart(12, "0")}`,
  });

const addSub = (ownerKey: string, name: string) =>
  db.insert(pushSubscriptions).values({
    ownerKey,
    endpoint: `https://push.example/${name}`,
    p256dh: "p",
    auth: "a",
  });

const sentTo = (sender: ReturnType<typeof vi.fn<Sender>>) =>
  sender.mock.calls.map(([sub]) => sub.endpoint.split("/").pop()).sort();

beforeEach(async () => {
  vi.restoreAllMocks();
  db = await createTestDb();
  state.db = db;
  seq = 0;
  push.resetChatPushForTests();
  vi.stubEnv("VAPID_PUBLIC_KEY", "pub");
  vi.stubEnv("NEXT_PUBLIC_VAPID_PUBLIC_KEY", "");
  vi.stubEnv("VAPID_PRIVATE_KEY", "priv");
  vi.stubEnv("VAPID_SUBJECT", "mailto:pt@example.com");
  await db.insert(admins).values([
    { username: "pt-one", usernameKey: "pt-one", passwordHash: "x" },
    { username: "pt-two", usernameKey: "pt-two", passwordHash: "x" },
  ]);
});

describe("mute rows", () => {
  it("upserts one row per owner and target and clears it idempotently", async () => {
    await mutes.setMute("admin:1", "user:5", null);
    await mutes.setMute("admin:1", "user:5", new Date(NOW.getTime() + HOUR));

    const rows = await db.select().from(chatMutes);

    expect(rows).toHaveLength(1);
    expect(rows[0].mutedUntil?.getTime()).toBe(NOW.getTime() + HOUR);

    await mutes.clearMute("admin:1", "user:5");
    await mutes.clearMute("admin:1", "user:5");
    expect(await db.select().from(chatMutes)).toHaveLength(0);
  });

  it("lists only active mutes of the owner, expired ones count as unmuted", async () => {
    await mutes.setMute("admin:1", "user:1", null);
    await mutes.setMute("admin:1", "user:2", new Date(NOW.getTime() + HOUR));
    await mutes.setMute("admin:1", "user:3", new Date(NOW.getTime() - HOUR));
    await mutes.setMute("admin:2", "user:4", null);

    const active = await mutes.listActiveMutes("admin:1", NOW);

    expect([...active.keys()].sort()).toEqual(["user:1", "user:2"]);
    expect(active.get("user:1")).toBeNull();
    expect((await mutes.listMutedUserIds(1, NOW)).has(3)).toBe(false);
  });

  it("reports one chat's state: active, forever, expired and absent", async () => {
    const until = new Date(NOW.getTime() + HOUR);

    await mutes.setMute("admin:1", "user:1", until);
    await mutes.setMute("admin:1", "user:2", null);
    await mutes.setMute("admin:1", "user:3", new Date(NOW.getTime() - HOUR));

    expect(await mutes.getMuteState(1, 1, NOW)).toEqual({
      muted: true,
      until: until.toISOString(),
    });
    expect(await mutes.getMuteState(1, 2, NOW)).toEqual({
      muted: true,
      until: null,
    });
    expect(await mutes.getMuteState(1, 3, NOW)).toEqual({
      muted: false,
      until: null,
    });
    // Another admin's mute is not mine.
    expect(await mutes.getMuteState(2, 1, NOW)).toEqual({
      muted: false,
      until: null,
    });
  });

  it("answers which of several owners muted a target, in one lookup", async () => {
    await mutes.setMute("admin:1", "user:9", null);
    await mutes.setMute("admin:2", "user:9", new Date(NOW.getTime() - 1));
    await mutes.setMute("admin:3", "user:8", null);

    const muted = await mutes.loadMutedOwnerKeys(
      "user:9",
      ["admin:1", "admin:2", "admin:3"],
      NOW,
    );

    expect([...muted]).toEqual(["admin:1"]);
    expect(await mutes.loadMutedOwnerKeys("user:9", [], NOW)).toEqual(
      new Set(),
    );
  });
});

describe("unread for a muting admin", () => {
  it("flags muted rows, keeps their count, and leaves them out of the total", async () => {
    const quiet = await addTrainee("An");
    const loud = await addTrainee("Binh");

    await fromTrainee(quiet.conversationId);
    await fromTrainee(quiet.conversationId);
    await fromTrainee(loud.conversationId);
    await mutes.setMute(`admin:${A}`, `user:${quiet.userId}`, null);

    const rows = await q.listUnreadByTraineeForAdmin(A);
    const byUser = new Map(rows.map((row) => [row.userId, row]));

    expect(byUser.get(quiet.userId)).toMatchObject({ unread: 2, muted: true });
    expect(byUser.get(loud.userId)).toMatchObject({ unread: 1, muted: false });
    expect(await q.countUnreadForAdmin(A)).toBe(1);
    // Another admin muted nobody: both chats count for them.
    expect(await q.countUnreadForAdmin(B)).toBe(3);
    expect(
      (await q.listUnreadByTraineeForAdmin(B)).every((row) => !row.muted),
    ).toBe(true);
  });

  it("counts a chat again once its mute has expired", async () => {
    const t = await addTrainee("An");

    await fromTrainee(t.conversationId);
    await mutes.setMute(
      `admin:${A}`,
      `user:${t.userId}`,
      new Date(Date.now() - 1000),
    );

    expect(await q.countUnreadForAdmin(A)).toBe(1);
    expect((await q.listUnreadByTraineeForAdmin(A))[0].muted).toBe(false);
  });

  it("marks the inbox row muted with its end, for the muting admin only", async () => {
    const t = await addTrainee("An");
    // Stored with second precision.
    const until = new Date(Math.floor((Date.now() + HOUR) / 1000) * 1000);

    await fromTrainee(t.conversationId);
    await mutes.setMute(`admin:${A}`, `user:${t.userId}`, until);

    const [mine] = (await q.listAdminInbox(A)).conversations;
    const [theirs] = (await q.listAdminInbox(B)).conversations;

    expect(mine).toMatchObject({ muted: true, unread: 1 });
    expect(mine.mutedUntil?.getTime()).toBe(until.getTime());
    expect(theirs).toMatchObject({ muted: false, mutedUntil: null });
  });
});

describe("chat push to a muting admin", () => {
  const traineeMessage = (t: { userId: number; conversationId: number }) => ({
    senderRole: "user" as const,
    traineeUserId: t.userId,
    conversationId: t.conversationId,
  });

  it("skips the muting admin for that trainee only", async () => {
    const t = await addTrainee("An");
    const other = await addTrainee("Binh");
    const sender = vi.fn<Sender>(async () => undefined);

    await addSub(`admin:${A}`, "a");
    await addSub(`admin:${B}`, "b");
    await mutes.setMute(`admin:${A}`, `user:${t.userId}`, null);

    await push.sendChatPush(traineeMessage(t), sender);
    expect(sentTo(sender)).toEqual(["b"]);

    sender.mockClear();
    await push.sendChatPush(traineeMessage(other), sender);
    expect(sentTo(sender)).toEqual(["a", "b"]);
  });

  it("pushes again after the mute expired", async () => {
    const t = await addTrainee("An");
    const sender = vi.fn<Sender>(async () => undefined);

    await addSub(`admin:${A}`, "a");
    await mutes.setMute(
      `admin:${A}`,
      `user:${t.userId}`,
      new Date(Date.now() - 1000),
    );

    await push.sendChatPush(traineeMessage(t), sender);
    expect(sentTo(sender)).toEqual(["a"]);
  });

  it("does not mute the trainee's own pushes", async () => {
    const t = await addTrainee("An");
    const sender = vi.fn<Sender>(async () => undefined);

    await addSub(`user:${t.userId}`, "trainee");
    await mutes.setMute(`admin:${A}`, `user:${t.userId}`, null);

    await push.sendChatPush(
      { ...traineeMessage(t), senderRole: "admin", senderAdminId: A },
      sender,
    );
    expect(sentTo(sender)).toEqual(["trainee"]);
  });

  it("skips the reaction push to the muting admin only", async () => {
    const t = await addTrainee("An");
    const sender = vi.fn<Sender>(async () => undefined);
    const input = (adminId: number) => ({
      recipient: { role: "admin" as const, adminId },
      reactorName: "An",
      emoji: "👍",
      traineeUserId: t.userId,
      conversationId: t.conversationId,
    });

    await addSub(`admin:${A}`, "a");
    await addSub(`admin:${B}`, "b");
    await mutes.setMute(`admin:${A}`, `user:${t.userId}`, null);

    await push.sendReactionPush(input(A), sender);
    expect(sender).not.toHaveBeenCalled();

    await push.sendReactionPush(input(B), sender);
    expect(sentTo(sender)).toEqual(["b"]);
  });
});

describe("direct message push", () => {
  it("skips a recipient who muted the sender and sends to one who did not", async () => {
    const sender = vi.fn<Sender>(async () => undefined);
    const from = await addTrainee("An");
    const muting = await addTrainee("Binh");
    const plain = await addTrainee("Cuc");

    await addSub(`user:${muting.userId}`, "muting");
    await addSub(`user:${plain.userId}`, "plain");
    await mutes.setMute(`user:${muting.userId}`, `user:${from.userId}`, null);

    const base = {
      senderId: from.userId,
      conversationId: 1,
      body: "hello",
      photo: false,
    };

    await dm.sendDmPush({ ...base, recipientId: muting.userId }, sender);
    expect(sender).not.toHaveBeenCalled();

    await dm.sendDmPush({ ...base, recipientId: plain.userId }, sender);
    expect(sentTo(sender)).toEqual(["plain"]);
  });
});
