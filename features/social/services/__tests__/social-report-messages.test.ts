import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createTestDb, type TestDb } from "@/db/__tests__/create-test-db";
import {
  admins,
  chatMessages,
  pushSubscriptions,
  socialReports,
  users,
} from "@/db/schema";
import { TERMS_VERSION } from "@/features/social/constants/social";
import type { SocialActor } from "@/features/social/types/social";
import { reportSchema } from "@/features/social/utils/friend-rules";

const state = vi.hoisted(() => ({
  db: null as unknown,
  user: null as unknown,
  admin: null as unknown,
  pending: [] as Promise<unknown>[],
  sent: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("web-push", () => ({ default: { sendNotification: state.sent } }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/server", () => ({
  after: (task: () => Promise<unknown>) => {
    state.pending.push(task());
  },
}));
vi.mock("@/services/logger", () => ({
  logServerError: vi.fn(() => ({ code: "UNKNOWN" })),
}));
vi.mock("@/services/admin-lock", () => ({
  canSeeHiddenUsers: vi.fn(async () => false),
}));
vi.mock("@/services/auth-guard", () => ({
  requireUser: vi.fn(async () => state.user),
  requireAdmin: vi.fn(async () => state.admin),
  requireSuperAdmin: vi.fn(async () => state.admin),
}));
vi.mock("@/db", () => ({
  db: new Proxy(
    {},
    { get: (_target, property) => Reflect.get(state.db as object, property) },
  ),
}));

const reports = await import("@/features/social/services/report-mutations");
const reportQueries = await import("@/features/social/services/report-queries");
const chat = await import("@/features/chat/services/chat-queries");
const moderation = await import("@/features/chat/services/chat-moderation");

let db: TestDb;
let seq = 0;
let superId: number;
let otherSuperId: number;
let ptA: number;
let ptB: number;
let alice: number; // PT A's trainee
let bob: number; // PT B's trainee
let aliceChat: number;
let bobChat: number;

const asUser = (id: number) => ({ kind: "user", id }) satisfies SocialActor;
const asAdmin = (id: number, role: "super_admin" | "pt") =>
  ({ kind: "admin", id, role }) satisfies SocialActor;

const addAdmin = async (name: string, role: "pt" | "super_admin" | null) => {
  const [row] = await db
    .insert(admins)
    .values({ username: name, usernameKey: name, passwordHash: "x", role })
    .returning({ id: admins.id });

  return row.id;
};

const addUser = async (name: string, ptAdminId: number | null) => {
  const [row] = await db
    .insert(users)
    .values({
      name,
      nameKey: name,
      ptAdminId,
      chatEnabled: true,
      termsVersion: TERMS_VERSION,
    })
    .returning({ id: users.id });

  return row.id;
};

const send = async (
  conversationId: number,
  from: { role: "user" } | { role: "admin"; adminId: number },
  extra: { body?: string; stickerRef?: string; stickerUrl?: string } = {},
) =>
  (
    await chat.insertMessage({
      conversationId,
      senderRole: from.role,
      senderAdminId: from.role === "admin" ? from.adminId : null,
      body: extra.body ?? "hello",
      stickerRef: extra.stickerRef,
      stickerUrl: extra.stickerUrl,
      clientId: `00000000-0000-4000-8000-${String(++seq).padStart(12, "0")}`,
    })
  ).id;

const report = (
  actor: SocialActor,
  messageId: number,
  extra: { reason?: string; reasonCode?: "spam" | "scam" } = {},
) =>
  reports.createReport(actor, {
    targetKind: "message",
    targetId: messageId,
    reasonCode: extra.reasonCode ?? "spam",
    reason: extra.reason ?? "",
  });

const rows = () => db.select().from(socialReports);

const settle = async () => {
  await Promise.all(state.pending);
  state.pending = [];
};

beforeEach(async () => {
  vi.unstubAllEnvs();
  state.sent.mockReset();
  state.sent.mockResolvedValue(undefined);
  state.pending = [];
  seq = 0;
  db = await createTestDb();
  state.db = db;
  superId = await addAdmin("root", null);
  otherSuperId = await addAdmin("root2", "super_admin");
  ptA = await addAdmin("pta", "pt");
  ptB = await addAdmin("ptb", "pt");
  alice = await addUser("alice", ptA);
  bob = await addUser("bob", ptB);
  aliceChat = (await chat.getOrCreateConversation(alice)).id;
  bobChat = (await chat.getOrCreateConversation(bob)).id;
  state.user = { id: alice, name: "alice", termsVersion: TERMS_VERSION };
  state.admin = { id: superId, role: "super_admin" };
});

describe("who may report a message", () => {
  it("a trainee reports a message from their PT or a super admin", async () => {
    const fromPt = await send(aliceChat, { role: "admin", adminId: ptA });
    const fromSuper = await send(aliceChat, {
      role: "admin",
      adminId: superId,
    });

    expect(await report(asUser(alice), fromPt)).toEqual({ ok: true });
    expect(await report(asUser(alice), fromSuper)).toEqual({ ok: true });
    expect(await rows()).toMatchObject([
      {
        reporterKey: `user:${alice}`,
        targetKind: "message",
        targetId: fromPt,
        reasonCode: "spam",
        status: "open",
      },
      { targetKind: "message", targetId: fromSuper },
    ]);
  });

  it("a trainee cannot report their own message", async () => {
    const own = await send(aliceChat, { role: "user" });

    expect(await report(asUser(alice), own)).toEqual({
      ok: false,
      error: "not_found",
    });
    expect(await rows()).toHaveLength(0);
  });

  it("a trainee cannot report a message in another trainee's conversation", async () => {
    const theirs = await send(bobChat, { role: "admin", adminId: ptB });
    const theirOwn = await send(bobChat, { role: "user" });

    for (const id of [theirs, theirOwn]) {
      expect(await report(asUser(alice), id)).toEqual({
        ok: false,
        error: "not_found",
      });
    }
    expect(await rows()).toHaveLength(0);
  });

  it("a PT reports a trainee message, not an admin message", async () => {
    const fromTrainee = await send(aliceChat, { role: "user" });
    const fromAdmin = await send(aliceChat, { role: "admin", adminId: ptA });

    expect(await report(asAdmin(ptA, "pt"), fromTrainee)).toEqual({ ok: true });
    expect(await report(asAdmin(ptA, "pt"), fromAdmin)).toEqual({
      ok: false,
      error: "not_found",
    });
  });

  it("a PT cannot report a message in a conversation they cannot access", async () => {
    const otherTrainee = await send(bobChat, { role: "user" });

    expect(await report(asAdmin(ptA, "pt"), otherTrainee)).toEqual({
      ok: false,
      error: "not_found",
    });
    expect(await rows()).toHaveLength(0);
  });

  it("a super admin never reports a message", async () => {
    const fromTrainee = await send(aliceChat, { role: "user" });

    expect(await report(asAdmin(superId, "super_admin"), fromTrainee)).toEqual({
      ok: false,
      error: "not_found",
    });
    expect(await rows()).toHaveLength(0);
  });

  it("refuses an unsent, hidden or missing message", async () => {
    const unsent = await send(aliceChat, { role: "admin", adminId: ptA });
    const hidden = await send(aliceChat, { role: "admin", adminId: ptA });

    await db
      .update(chatMessages)
      .set({ deletedAt: new Date() })
      .where(eq(chatMessages.id, unsent));
    await moderation.hideMessageByAdmin(superId, hidden);

    for (const id of [unsent, hidden, 9999]) {
      expect(await report(asUser(alice), id)).toEqual({
        ok: false,
        error: "not_found",
      });
    }
    expect(await rows()).toHaveLength(0);
  });

  it("a restricted trainee can still report", async () => {
    const fromPt = await send(aliceChat, { role: "admin", adminId: ptA });

    // Reporting never applies the restriction guard: nothing blocks the call.
    expect(await report(asUser(alice), fromPt)).toEqual({ ok: true });
  });
});

describe("reasons", () => {
  it("requires a known reasonCode and keeps the note", () => {
    expect(
      reportSchema.safeParse({ targetKind: "message", targetId: 1 }).success,
    ).toBe(false);
    expect(
      reportSchema.safeParse({
        targetKind: "message",
        targetId: 1,
        reasonCode: "nope",
      }).success,
    ).toBe(false);
    expect(
      reportSchema.safeParse({
        targetKind: "user",
        targetId: 1,
        reasonCode: "scam",
        reason: "  link in chat  ",
      }),
    ).toMatchObject({
      success: true,
      data: { reasonCode: "scam", reason: "link in chat" },
    });
  });

  it("stores the note next to the code", async () => {
    const fromPt = await send(aliceChat, { role: "admin", adminId: ptA });

    await report(asUser(alice), fromPt, {
      reasonCode: "scam",
      reason: " bad ",
    });
    expect((await rows())[0]).toMatchObject({
      reasonCode: "scam",
      reason: "bad",
    });
  });

  it("an old report without a code lists as no reason", async () => {
    await db.insert(socialReports).values({
      reporterKey: `user:${alice}`,
      targetKind: "user",
      targetId: bob,
      reason: "old",
      status: "open",
      createdAt: new Date(),
    });
    const [item] = await reportQueries.listOpenReports();

    expect(item).toMatchObject({ reasonCode: null, reason: "old" });
  });
});

describe("duplicates and push", () => {
  const subscribe = async (ownerKey: string, name: string) => {
    await db.insert(pushSubscriptions).values({
      ownerKey,
      endpoint: `https://fcm.googleapis.com/${name}`,
      p256dh: "p",
      auth: "a",
    });
  };

  beforeEach(async () => {
    vi.stubEnv("VAPID_PUBLIC_KEY", "pub");
    vi.stubEnv("NEXT_PUBLIC_VAPID_PUBLIC_KEY", "");
    vi.stubEnv("VAPID_PRIVATE_KEY", "priv");
    vi.stubEnv("VAPID_SUBJECT", "mailto:pt@example.com");
    await subscribe(`admin:${superId}`, "super-1");
    await subscribe(`admin:${otherSuperId}`, "super-2");
    await subscribe(`admin:${ptA}`, "pt-a");
    await subscribe(`user:${alice}`, "alice");
  });

  it("a duplicate open report is a no-op and sends no second push", async () => {
    const fromPt = await send(aliceChat, { role: "admin", adminId: ptA });

    expect(await report(asUser(alice), fromPt)).toEqual({ ok: true });
    expect(await report(asUser(alice), fromPt)).toEqual({ ok: true });
    await settle();
    expect(await rows()).toHaveLength(1);
    expect(state.sent).toHaveBeenCalledTimes(2);
  });

  it("pushes every super admin device once, nobody else, with a link", async () => {
    const fromPt = await send(aliceChat, { role: "admin", adminId: ptA });

    await report(asUser(alice), fromPt);
    await settle();
    const endpoints = state.sent.mock.calls.map(
      ([subscription]) => subscription.endpoint,
    );
    const payload = JSON.parse(state.sent.mock.calls[0][1]);

    expect(endpoints.sort()).toEqual([
      "https://fcm.googleapis.com/super-1",
      "https://fcm.googleapis.com/super-2",
    ]);
    expect(payload).toMatchObject({
      body: "Báo cáo mới: tin nhắn",
      url: "/admin/reports",
    });
  });

  it("a refused report sends nothing", async () => {
    const own = await send(aliceChat, { role: "user" });

    await report(asUser(alice), own);
    await settle();
    expect(state.sent).not.toHaveBeenCalled();
  });

  it("a post or user report notifies too", async () => {
    await reports.createReport(asUser(alice), {
      targetKind: "user",
      targetId: bob,
      reasonCode: "harassment",
      reason: "",
    });
    await settle();
    expect(state.sent).toHaveBeenCalledTimes(2);
    expect(JSON.parse(state.sent.mock.calls[0][1]).body).toBe(
      "Báo cáo mới: người dùng",
    );
  });
});

describe("resolving a message report", () => {
  it("hidden sets hidden_by_admin_id, closes every open report, redacts the message", async () => {
    const fromTrainee = await send(
      aliceChat,
      { role: "user" },
      { body: "buy now" },
    );

    await report(asAdmin(ptA, "pt"), fromTrainee);
    await db.insert(socialReports).values({
      reporterKey: `admin:${ptA}`,
      targetKind: "message",
      targetId: fromTrainee,
      reasonCode: "scam",
      reason: "",
      status: "resolved",
      resolution: "kept",
      createdAt: new Date(0),
    });
    const [open] = await db
      .select()
      .from(socialReports)
      .where(eq(socialReports.status, "open"));

    expect(
      await reports.resolveReport(
        asAdmin(superId, "super_admin"),
        open.id,
        "hidden",
      ),
    ).toEqual({ ok: true });
    const [stored] = await db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.id, fromTrainee));

    expect(stored.hiddenByAdminId).toBe(superId);
    expect((await rows()).filter((row) => row.status === "open")).toHaveLength(
      0,
    );
    expect(
      (
        await db
          .select()
          .from(socialReports)
          .where(eq(socialReports.id, open.id))
      )[0],
    ).toMatchObject({
      status: "resolved",
      resolution: "hidden",
      resolvedBy: superId,
    });
    const [seen] = (await chat.listMessages(aliceChat, {})).messages;

    expect(seen).toMatchObject({ id: fromTrainee, deleted: true, body: "" });
  });

  it("kept leaves the message alone", async () => {
    const fromTrainee = await send(aliceChat, { role: "user" });

    await report(asAdmin(ptA, "pt"), fromTrainee);
    const [open] = await rows();

    await reports.resolveReport(
      asAdmin(superId, "super_admin"),
      open.id,
      "kept",
    );
    const [stored] = await db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.id, fromTrainee));

    expect(stored.hiddenByAdminId).toBeNull();
    expect((await rows())[0].resolution).toBe("kept");
  });

  it("refuses hidden on a non-message report and deleted on a message report", async () => {
    const fromTrainee = await send(aliceChat, { role: "user" });

    await report(asAdmin(ptA, "pt"), fromTrainee);
    await reports.createReport(asUser(alice), {
      targetKind: "user",
      targetId: bob,
      reasonCode: "spam",
      reason: "",
    });
    const [messageReport, userReport] = await rows();

    expect(
      await reports.resolveReport(
        asAdmin(superId, "super_admin"),
        userReport.id,
        "hidden",
      ),
    ).toEqual({ ok: false, error: "forbidden" });
    expect(
      await reports.resolveReport(
        asAdmin(superId, "super_admin"),
        messageReport.id,
        "deleted",
      ),
    ).toEqual({ ok: false, error: "forbidden" });
    expect((await rows()).filter((row) => row.status === "open")).toHaveLength(
      2,
    );
  });

  it("only a super admin resolves", async () => {
    const fromTrainee = await send(aliceChat, { role: "user" });

    await report(asAdmin(ptA, "pt"), fromTrainee);
    const [open] = await rows();

    expect(
      await reports.resolveReport(asAdmin(ptA, "pt"), open.id, "hidden"),
    ).toEqual({ ok: false, error: "forbidden" });
  });

  it("hiding is idempotent and keeps the first admin", async () => {
    const fromTrainee = await send(aliceChat, { role: "user" });

    expect(await moderation.hideMessageByAdmin(superId, fromTrainee)).toEqual({
      hidden: true,
    });
    expect(
      await moderation.hideMessageByAdmin(otherSuperId, fromTrainee),
    ).toEqual({ hidden: true });
    expect(await moderation.hideMessageByAdmin(superId, 9999)).toEqual({
      hidden: false,
    });
    const [stored] = await db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.id, fromTrainee));

    expect(stored.hiddenByAdminId).toBe(superId);
  });
});

describe("the queue", () => {
  it("lists a message report with preview, sender, trainee, reason and link", async () => {
    const text = await send(aliceChat, { role: "user" }, { body: "buy now!!" });

    await report(asAdmin(ptA, "pt"), text, {
      reasonCode: "scam",
      reason: "link",
    });
    const [item] = await reportQueries.listOpenReports();

    expect(item).toMatchObject({
      targetKind: "message",
      targetId: text,
      preview: "buy now!!",
      reasonCode: "scam",
      reason: "link",
      reporterName: "pta",
      targetName: "alice",
      href: `/admin/users/${alice}/messages?m=${text}`,
      message: {
        senderRole: "user",
        senderName: "alice",
        traineeId: alice,
        traineeName: "alice",
        kind: "text",
      },
    });
  });

  it("labels a sticker and names an admin sender", async () => {
    const sticker = await send(
      aliceChat,
      { role: "admin", adminId: ptA },
      {
        body: "",
        stickerRef: "pack:1",
        stickerUrl: "/stickers/1.png",
      },
    );

    await report(asUser(alice), sticker);
    const [item] = await reportQueries.listOpenReports();

    expect(item.message).toMatchObject({
      senderRole: "admin",
      senderName: "pta",
      traineeName: "alice",
      kind: "sticker",
    });
    expect(item.preview).toBe("(Sticker)");
  });

  it("a message hidden or unsent meanwhile shows no preview and no link", async () => {
    const text = await send(aliceChat, { role: "user" });

    await report(asAdmin(ptA, "pt"), text);
    await db
      .update(chatMessages)
      .set({ deletedAt: new Date() })
      .where(eq(chatMessages.id, text));
    const [item] = await reportQueries.listOpenReports();

    expect(item).toMatchObject({ preview: null, href: null, message: null });
  });
});
