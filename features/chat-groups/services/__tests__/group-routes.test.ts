import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createTestDb, type TestDb } from "@/db/__tests__/create-test-db";
import {
  chatGroupMembers,
  chatGroupMessages,
  chatGroupPhotos,
  chatGroups,
} from "@/db/schema";
import {
  seedAdmin,
  seedGroup,
  seedMessage,
  seedUser,
} from "@/features/chat-groups/services/__tests__/seed";

const state = vi.hoisted(() => ({
  db: null as unknown,
  configured: true,
  user: null as null | { id: number; chatEnabled: boolean | null },
  admin: null as null | { id: number; role: "super_admin" | "pt" },
}));

vi.mock("server-only", () => ({}));
vi.mock("@/services/auth-guard", () => ({
  getApiUser: vi.fn(async () => state.user),
  getApiAdmin: vi.fn(async () => state.admin),
}));
vi.mock("@/services/localize-message", () => ({
  localizeResult: vi.fn(async (value: unknown) => value),
}));
vi.mock("@/features/chat/services/chat-realtime", () => ({
  isRealtimeConfigured: () => state.configured,
  createChatTokenRequest: vi.fn(async (input: unknown) => ({ signed: input })),
  publishChatEvent: vi.fn(async () => {}),
}));
vi.mock("@/db", () => ({
  db: new Proxy(
    {},
    { get: (_target, property) => Reflect.get(state.db as object, property) },
  ),
}));

const listRoute = await import("@/app/api/chat/groups/route");
const messagesRoute =
  await import("@/app/api/chat/groups/[groupId]/messages/route");
const editsRoute =
  await import("@/app/api/chat/groups/[groupId]/messages/[messageId]/edits/route");
const seenRoute =
  await import("@/app/api/chat/groups/[groupId]/messages/[messageId]/seen/route");
const membersRoute =
  await import("@/app/api/chat/groups/[groupId]/members/route");
const photosRoute =
  await import("@/app/api/chat/groups/[groupId]/photos/route");
const photoRoute =
  await import("@/app/api/chat/groups/[groupId]/photos/[photoId]/route");
const avatarRoute =
  await import("@/app/api/chat/groups/[groupId]/avatar/route");
const tokenRoute = await import("@/app/api/chat/ably-token/route");
const unreadRoute = await import("@/app/api/chat/unread/route");

let db: TestDb;
let superId: number;
let ptId: number;
let anId: number;
let outsiderId: number;
let groupId: number;
let firstId: number;

const req = (
  path: string,
  init?: ConstructorParameters<typeof NextRequest>[1],
) => new NextRequest(`http://localhost${path}`, init);
const params = (values: Record<string, string>) => ({
  params: Promise.resolve(values),
});
const asTrainee = (id = anId, chatEnabled: boolean | null = true) => {
  state.user = { id, chatEnabled };
  state.admin = null;
};
const asSuper = () => {
  state.user = null;
  state.admin = { id: superId, role: "super_admin" };
};

const getMessages = (id: string | number, query = "", as = "") =>
  messagesRoute.GET(
    req(`/api/chat/groups/${id}/messages${query}${as}`),
    params({ groupId: String(id) }),
  );

// A 24-byte PNG header is all the byte checks read.
const pngBytes = () => {
  const bytes = new Uint8Array(32);

  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  bytes.set([0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52], 8);
  bytes.set([0, 0, 0, 10], 16);
  bytes.set([0, 0, 0, 10], 20);
  return bytes;
};

beforeEach(async () => {
  db = await createTestDb();
  state.db = db;
  state.configured = true;
  superId = await seedAdmin(db, "Boss", null, new Date(1000));
  ptId = await seedAdmin(db, "Coach", "pt");
  anId = await seedUser(db, "An");
  outsiderId = await seedUser(db, "Binh");
  groupId = await seedGroup(db, {
    createdByKey: `admin:${ptId}`,
    members: [`admin:${ptId}`, `user:${anId}`],
  });
  firstId = await seedMessage(db, groupId, `admin:${ptId}`, "Chào cả nhóm");
  asTrainee();
});

describe("GET /api/chat/groups", () => {
  it("returns 401 without a session", async () => {
    state.user = null;
    const response = await listRoute.GET(req("/api/chat/groups"));

    expect(response.status).toBe(401);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("lists the trainee's own groups and, for a super admin, every group", async () => {
    await seedGroup(db, { createdByKey: `admin:${ptId}`, name: "Khác" });
    const own = await (await listRoute.GET(req("/api/chat/groups"))).json();

    expect(own.groups.map((g: { id: number }) => g.id)).toEqual([groupId]);
    asSuper();
    const all = await (
      await listRoute.GET(req("/api/chat/groups?as=admin"))
    ).json();

    expect(all.groups).toHaveLength(2);
  });

  it("serves the trainee view when both cookies exist and the admin view is not asked for", async () => {
    state.admin = { id: superId, role: "super_admin" };
    await seedGroup(db, { createdByKey: `admin:${ptId}`, name: "Khác" });
    const body = await (await listRoute.GET(req("/api/chat/groups"))).json();

    expect(body.groups).toHaveLength(1);
  });
});

describe("GET /api/chat/groups/[groupId]/messages", () => {
  it("returns the page with the group's state for a member", async () => {
    const response = await getMessages(groupId);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(body.messages.map((m: { id: number }) => m.id)).toEqual([firstId]);
    expect(body.messages[0]).toMatchObject({
      senderName: "Coach",
      senderTag: "pt",
      body: "Chào cả nhóm",
    });
    expect(body).toMatchObject({
      hasMore: false,
      group: { id: groupId, managersOnly: false, dissolved: false },
    });
  });

  it("returns what changed since a cursor", async () => {
    await db
      .update(chatGroupMessages)
      .set({ updatedAt: new Date(9000) })
      .where(eq(chatGroupMessages.id, firstId));
    await db.update(chatGroups).set({ lastChangeAt: new Date(9000) });
    const none = await (
      await getMessages(groupId, "?after=1&changedSince=9000")
    ).json();
    const some = await (
      await getMessages(groupId, "?after=1&changedSince=8000")
    ).json();

    expect(none.changes).toEqual([]);
    expect(none.lastChangeAt).toBe(9000);
    expect(some.changes.map((m: { id: number }) => m.id)).toEqual([firstId]);
  });

  it.each([
    ["an unknown group", () => 9999],
    ["a bad id", () => "abc"],
    ["a zero id", () => 0],
  ])("answers 404 for %s", async (_name, id) => {
    const response = await getMessages(id());

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "not_found" });
  });

  it("answers 404 for a trainee who is not a member, and for one who left", async () => {
    asTrainee(outsiderId);
    expect((await getMessages(groupId)).status).toBe(404);
    asTrainee();
    await db
      .update(chatGroupMembers)
      .set({ leftAt: new Date() })
      .where(eq(chatGroupMembers.memberKey, `user:${anId}`));
    expect((await getMessages(groupId)).status).toBe(404);
  });

  it("answers 404 for a dissolved group to a member but lets a super admin read it", async () => {
    await db.update(chatGroups).set({ dissolvedAt: new Date() });
    expect((await getMessages(groupId)).status).toBe(404);
    asSuper();
    const response = await getMessages(groupId, "", "?as=admin");

    expect(response.status).toBe(200);
    expect((await response.json()).group.dissolved).toBe(true);
  });

  it("rejects after and before together with 400, after membership is known", async () => {
    expect((await getMessages(groupId, "?after=1&before=2")).status).toBe(400);
    asTrainee(outsiderId);
    expect((await getMessages(groupId, "?after=1&before=2")).status).toBe(404);
  });

  it("sends the alert to a super admin only", async () => {
    const alert = await seedMessage(db, groupId, null, "", {
      audience: "super_admin",
      systemEvent: "{}",
    });
    const forTrainee = await (await getMessages(groupId)).json();

    expect(forTrainee.messages.map((m: { id: number }) => m.id)).toEqual([
      firstId,
    ]);
    asSuper();
    const forSuper = await (await getMessages(groupId, "", "?as=admin")).json();

    expect(forSuper.messages.map((m: { id: number }) => m.id)).toEqual([
      firstId,
      alert,
    ]);
  });
});

describe("edits, seen and members routes", () => {
  const edits = (g: string, m: string) =>
    editsRoute.GET(
      req(`/api/chat/groups/${g}/messages/${m}/edits`),
      params({ groupId: g, messageId: m }),
    );
  const seen = (g: string, m: string) =>
    seenRoute.GET(
      req(`/api/chat/groups/${g}/messages/${m}/seen`),
      params({ groupId: g, messageId: m }),
    );
  const members = (g: string) =>
    membersRoute.GET(
      req(`/api/chat/groups/${g}/members`),
      params({ groupId: g }),
    );

  it("serve a member and answer 404 for everything else", async () => {
    await db
      .insert(await import("@/db/schema").then((m) => m.chatGroupMessageEdits))
      .values({
        messageId: firstId,
        previousBody: "cũ",
        editedAt: new Date(),
      });
    expect(
      await (await edits(String(groupId), String(firstId))).json(),
    ).toEqual({ edits: [expect.objectContaining({ previousBody: "cũ" })] });
    expect(await (await seen(String(groupId), String(firstId))).json()).toEqual(
      {
        seenBy: [],
      },
    );
    const body = await (await members(String(groupId))).json();

    expect(body.members.map((m: { name: string }) => m.name).sort()).toEqual([
      "An",
      "Boss",
      "Coach",
    ]);
    expect(body).toMatchObject({ canManage: false, managersOnly: false });

    for (const call of [
      () => edits(String(groupId), "9999"),
      () => edits(String(groupId), "x"),
      () => edits("9999", String(firstId)),
      () => seen(String(groupId), "9999"),
      () => members("9999"),
    ]) {
      expect((await call()).status).toBe(404);
    }
    asTrainee(outsiderId);
    for (const call of [
      () => edits(String(groupId), String(firstId)),
      () => seen(String(groupId), String(firstId)),
      () => members(String(groupId)),
    ]) {
      expect((await call()).status).toBe(404);
    }
  });

  it("do not leak a message of another group through this group's URL", async () => {
    const other = await seedGroup(db, {
      createdByKey: `admin:${ptId}`,
      members: [`user:${anId}`],
    });
    const foreign = await seedMessage(db, other, `user:${anId}`, "ở nhóm khác");

    expect((await edits(String(groupId), String(foreign))).status).toBe(404);
    expect((await seen(String(groupId), String(foreign))).status).toBe(404);
  });
});

describe("photo routes", () => {
  const upload = (
    id: string | number,
    init: ConstructorParameters<typeof NextRequest>[1] = {},
    query = "",
  ) =>
    photosRoute.POST(
      req(`/api/chat/groups/${id}/photos${query}`, {
        method: "POST",
        body: pngBytes(),
        ...init,
      }),
      params({ groupId: String(id) }),
    );
  const download = (g: string | number, p: string | number) =>
    photoRoute.GET(
      req(`/api/chat/groups/${g}/photos/${p}`),
      params({ groupId: String(g), photoId: String(p) }),
    );

  it("stores a pending photo for a member", async () => {
    const response = await upload(groupId);

    expect(response.status).toBe(201);
    const { photo } = await response.json();
    const [row] = await db.select().from(chatGroupPhotos);

    expect(row).toMatchObject({
      id: photo.id,
      groupId,
      uploaderKey: `user:${anId}`,
      messageId: null,
      mime: "image/png",
    });
  });

  it("refuses a foreign origin, no session, a non-member and a bad image", async () => {
    expect(
      (await upload(groupId, { headers: { origin: "http://evil.example" } }))
        .status,
    ).toBe(403);
    state.user = null;
    expect((await upload(groupId)).status).toBe(401);
    asTrainee(outsiderId);
    expect((await upload(groupId)).status).toBe(404);
    expect((await upload(9999)).status).toBe(404);
    asTrainee();
    expect(
      (await upload(groupId, { body: new Uint8Array([1, 2, 3, 4]) })).status,
    ).toBe(400);
    expect(await db.select().from(chatGroupPhotos)).toHaveLength(0);
  });

  it("applies the send rules to uploads: managers-only and chat off", async () => {
    await db.update(chatGroups).set({ managersOnly: true });
    expect((await upload(groupId)).status).toBe(403);
    asSuper();
    expect((await upload(groupId, {}, "?as=admin")).status).toBe(201);
    await db.update(chatGroups).set({ managersOnly: null });
    asTrainee(anId, false);
    expect((await upload(groupId)).status).toBe(403);
  });

  it("serves a sent photo to members only, and never a pending one", async () => {
    const [sent] = await db
      .insert(chatGroupPhotos)
      .values({
        groupId,
        messageId: firstId,
        uploaderKey: `admin:${ptId}`,
        mime: "image/webp",
        width: 1,
        height: 1,
        data: Buffer.from([7, 8, 9]),
        size: 3,
        createdAt: new Date(),
      })
      .returning({ id: chatGroupPhotos.id });
    const [pending] = await db
      .insert(chatGroupPhotos)
      .values({
        groupId,
        messageId: null,
        uploaderKey: `user:${anId}`,
        mime: "image/webp",
        width: 1,
        height: 1,
        data: Buffer.from([1]),
        size: 1,
        createdAt: new Date(),
      })
      .returning({ id: chatGroupPhotos.id });
    const ok = await download(groupId, sent.id);

    expect(ok.status).toBe(200);
    expect(ok.headers.get("Content-Type")).toBe("image/webp");
    expect([...new Uint8Array(await ok.arrayBuffer())]).toEqual([7, 8, 9]);
    expect((await download(groupId, pending.id)).status).toBe(404);
    // Wrong group in the URL.
    expect((await download(groupId + 1, sent.id)).status).toBe(404);
    expect((await download("x", sent.id)).status).toBe(404);
    asTrainee(outsiderId);
    expect((await download(groupId, sent.id)).status).toBe(404);
    state.user = null;
    expect((await download(groupId, sent.id)).status).toBe(401);
  });
});

describe("GET /api/chat/groups/[groupId]/avatar", () => {
  const avatar = (id: string | number) =>
    avatarRoute.GET(
      req(`/api/chat/groups/${id}/avatar`),
      params({ groupId: String(id) }),
    );
  const png = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 5, 6,
  ]);

  it("serves the photo to a member, 404 to others and when there is none", async () => {
    expect((await avatar(groupId)).status).toBe(404);
    await db.update(chatGroups).set({
      avatar: `data:image/png;base64,${png.toString("base64")}`,
      avatarUpdatedAt: new Date(),
    });
    const response = await avatar(groupId);

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("image/png");
    expect(Buffer.from(await response.arrayBuffer())).toEqual(png);
    asTrainee(outsiderId);
    expect((await avatar(groupId)).status).toBe(404);
    expect((await avatar(9999)).status).toBe(404);
  });
});

describe("GET /api/chat/ably-token?group=", () => {
  const token = (query: string) =>
    tokenRoute.GET(req(`/api/chat/ably-token${query}`));

  it("signs a subscribe-only token for exactly that one channel", async () => {
    const response = await token(`?group=${groupId}`);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      signed: {
        clientId: `user:${anId}`,
        capability: { [`chat:group:${groupId}`]: ["subscribe"] },
      },
    });
  });

  it("gives a super admin the same single channel, never a wildcard", async () => {
    asSuper();
    const body = await (await token(`?group=${groupId}&as=admin`)).json();

    expect(body.signed.clientId).toBe(`admin:${superId}`);
    expect(body.signed.capability).toEqual({
      [`chat:group:${groupId}`]: ["subscribe"],
    });
  });

  it("lets a trainee with chat off read, so they still get a token", async () => {
    asTrainee(anId, false);
    expect((await token(`?group=${groupId}`)).status).toBe(200);
  });

  it("refuses non-members, left members, dissolved groups and bad ids with 404", async () => {
    asTrainee(outsiderId);
    expect((await token(`?group=${groupId}`)).status).toBe(404);
    asTrainee();
    expect((await token("?group=9999")).status).toBe(404);
    expect((await token("?group=abc")).status).toBe(404);
    await db
      .update(chatGroupMembers)
      .set({ leftAt: new Date() })
      .where(eq(chatGroupMembers.memberKey, `user:${anId}`));
    expect((await token(`?group=${groupId}`)).status).toBe(404);
    await db
      .update(chatGroupMembers)
      .set({ leftAt: null })
      .where(eq(chatGroupMembers.memberKey, `user:${anId}`));
    await db.update(chatGroups).set({ dissolvedAt: new Date() });
    expect((await token(`?group=${groupId}`)).status).toBe(404);
    // Even a super admin gets no token for a dissolved group.
    asSuper();
    expect((await token(`?group=${groupId}&as=admin`)).status).toBe(404);
  });

  it("answers 401 without a session and 204 when Ably is not configured", async () => {
    state.user = null;
    expect((await token(`?group=${groupId}`)).status).toBe(401);
    asTrainee();
    state.configured = false;
    expect((await token(`?group=${groupId}`)).status).toBe(204);
  });
});

describe("GET /api/chat/unread groups field", () => {
  it("adds total and per-group counts for a trainee next to the existing fields", async () => {
    const body = await (await unreadRoute.GET(req("/api/chat/unread"))).json();

    expect(body.groups).toEqual({
      total: 1,
      perGroup: [{ groupId, unread: 1 }],
    });
    expect(body).toMatchObject({ count: 0, coachCount: 0, dmCount: 0 });
  });

  it("adds it for an admin and counts nothing for system lines", async () => {
    await seedMessage(db, groupId, null, "");
    asSuper();
    const body = await (
      await unreadRoute.GET(req("/api/chat/unread?as=admin"))
    ).json();

    expect(body.groups).toEqual({
      total: 1,
      perGroup: [{ groupId, unread: 1 }],
    });
    expect(body.perTrainee).toEqual([]);
  });
});
