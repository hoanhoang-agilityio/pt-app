import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createTestDb, type TestDb } from "@/db/__tests__/create-test-db";
import {
  admins,
  chatColorOverrides,
  chatConversations,
  chatMessages,
  chatNicknames,
  contactAliases,
  users,
} from "@/db/schema";
import { CHAT_MESSAGES } from "@/features/chat/constants/messages";
import { CHAT_NICKNAME_MAX_LENGTH } from "@/features/chat/utils/chat-rules";

const state = vi.hoisted(() => ({
  db: null as unknown,
  role: "user" as "user" | "admin",
  userId: 1,
  adminId: 1,
}));

vi.mock("server-only", () => ({}));
vi.mock("@/features/chat/services/chat-push", () => ({
  schedulePush: vi.fn(),
  scheduleReactionPush: vi.fn(),
  sendChatPush: vi.fn(),
  sendReactionPush: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/features/chat/services/chat-realtime", () => ({
  publishProfileUpdate: vi.fn(async () => undefined),
}));
vi.mock("@/services/session", () => ({
  readSession: vi.fn(async () =>
    state.role === "admin"
      ? { role: "admin", adminId: state.adminId }
      : { role: "user", userId: state.userId },
  ),
}));
vi.mock("@/services/admins", () => ({
  findAdminById: vi.fn(async (id: number) => ({ id, username: `pt${id}` })),
}));
vi.mock("@/services/auth-guard", async () => {
  const { eq: equals } = await import("drizzle-orm");
  const { users: usersTable } = await import("@/db/schema");

  return {
    requireUser: vi.fn(async () => {
      const [row] = await (state.db as TestDb)
        .select()
        .from(usersTable)
        .where(equals(usersTable.id, state.userId));

      return row;
    }),
    requireAdmin: vi.fn(async () => ({
      id: state.adminId,
      username: `pt${state.adminId}`,
    })),
    getApiUser: vi.fn(async () => {
      const [row] = await (state.db as TestDb)
        .select()
        .from(usersTable)
        .where(equals(usersTable.id, state.userId));

      return row ?? null;
    }),
    getApiAdmin: vi.fn(async () => ({ id: state.adminId })),
  };
});
vi.mock("@/services/users", async () => {
  const { eq: equals } = await import("drizzle-orm");
  const { users: usersTable } = await import("@/db/schema");

  return {
    findUserById: vi.fn(async (id: number) => {
      const [row] = await (state.db as TestDb)
        .select()
        .from(usersTable)
        .where(equals(usersTable.id, id));

      return row ?? null;
    }),
  };
});
vi.mock("@/db", () => ({
  db: new Proxy(
    {},
    { get: (_target, property) => Reflect.get(state.db as object, property) },
  ),
}));

const push = await import("@/features/chat/services/chat-push");
const actions = await import("@/features/chat/services/chat-profile-actions");
const realtime = await import("@/features/chat/services/chat-realtime");
const queries = await import("@/features/chat/services/chat-queries");
const userRoute = await import("@/app/api/chat/messages/route");
const adminRoute =
  await import("@/app/api/admin/chat/[conversationId]/messages/route");

let db: TestDb;
let userId: number;
let otherUserId: number;
let conversationId: number;
let otherConversationId: number;

const get = (path: string) => new NextRequest(`http://localhost${path}`);
const cursor = async (id = conversationId) =>
  (
    await db
      .select()
      .from(chatConversations)
      .where(eq(chatConversations.id, id))
  )[0].lastChangeAt;

const asUser = () => {
  state.role = "user";
  state.userId = userId;
};
const asAdmin = (id = 1) => {
  state.role = "admin";
  state.adminId = id;
};

beforeEach(async () => {
  vi.clearAllMocks();
  db = await createTestDb();
  state.db = db;
  await db.insert(admins).values([
    { username: "pt1", usernameKey: "pt1", passwordHash: "x" },
    { username: "pt2", usernameKey: "pt2", passwordHash: "x" },
  ]);
  // Two trainees with the same display name (names are not unique keys).
  const rows = await db
    .insert(users)
    .values([
      { name: "An", nameKey: "an", chatEnabled: true },
      { name: "An", nameKey: "an-2", chatEnabled: true },
    ])
    .returning({ id: users.id });

  userId = rows[0].id;
  otherUserId = rows[1].id;
  conversationId = (await queries.getOrCreateConversation(userId)).id;
  otherConversationId = (await queries.getOrCreateConversation(otherUserId)).id;
  asUser();
});

describe("nicknames", () => {
  it("lets the trainee set nicknames for themself, the PT side and an admin", async () => {
    for (const [target, nickname] of [
      ["user", "Bé Na"],
      ["pt", "Coach"],
      ["admin:2", "Thầy Hai"],
    ]) {
      const result = await actions.setNicknameAction({ target, nickname });

      expect(result.status).toBe("success");
    }
    const rows = await db.select().from(chatNicknames);

    expect(
      Object.fromEntries(rows.map((row) => [row.targetKey, row.nickname])),
    ).toEqual({ user: "Bé Na", pt: "Coach", "admin:2": "Thầy Hai" });
    expect(rows.every((row) => row.setByKey === "user")).toBe(true);
    expect(rows.every((row) => row.conversationId === conversationId)).toBe(
      true,
    );
  });

  it("lets an admin set and clear nicknames in a conversation, recording who", async () => {
    asAdmin(2);
    await actions.adminSetNicknameAction({
      conversationId,
      target: "user",
      nickname: "Bé Na",
    });
    const [row] = await db.select().from(chatNicknames);

    expect(row).toMatchObject({
      conversationId,
      targetKey: "user",
      nickname: "Bé Na",
      setByKey: "admin:2",
    });

    const cleared = await actions.adminSetNicknameAction({
      conversationId,
      target: "user",
      nickname: "",
    });

    expect(cleared).toEqual({
      status: "success",
      profile: { nicknames: {}, colors: {} },
    });
    expect(await db.select().from(chatNicknames)).toEqual([]);
  });

  it("trims, collapses whitespace and replaces the previous value", async () => {
    await actions.setNicknameAction({
      target: "pt",
      nickname: "  Big   Coach ",
    });
    const result = await actions.setNicknameAction({
      target: "pt",
      nickname: "Coach",
    });

    expect(result).toMatchObject({
      status: "success",
      profile: { nicknames: { pt: "Coach" } },
    });
    expect(await db.select().from(chatNicknames)).toHaveLength(1);
  });

  it("stores the trimmed form", async () => {
    await actions.setNicknameAction({
      target: "pt",
      nickname: "  Big   Coach ",
    });

    expect((await db.select().from(chatNicknames))[0].nickname).toBe(
      "Big Coach",
    );
  });

  it("accepts exactly the max length and rejects one more (characters, not bytes)", async () => {
    const ok = "ê".repeat(CHAT_NICKNAME_MAX_LENGTH);
    const okResult = await actions.setNicknameAction({
      target: "user",
      nickname: ok,
    });

    expect(okResult.status).toBe("success");
    const tooLong = await actions.setNicknameAction({
      target: "user",
      nickname: `${ok}x`,
    });

    expect(tooLong).toEqual({
      status: "error",
      message: CHAT_MESSAGES.NICKNAME_INVALID,
    });
    expect((await db.select().from(chatNicknames))[0].nickname).toBe(ok);
  });

  it.each([
    ["unknown target", { target: "everyone", nickname: "x" }],
    ["admin target without id", { target: "admin:", nickname: "x" }],
    ["admin target with junk id", { target: "admin:1abc", nickname: "x" }],
    ["admin id 0", { target: "admin:0", nickname: "x" }],
    ["control characters", { target: "user", nickname: "a\u0000b" }],
    ["non-string nickname", { target: "user", nickname: 5 }],
    ["missing input", undefined],
    ["null input", null],
  ])("rejects bad input: %s", async (_label, input) => {
    const result = await actions.setNicknameAction(
      input as { target: string; nickname: string },
    );

    expect(result.status).toBe("error");
    expect(await db.select().from(chatNicknames)).toEqual([]);
  });

  it("rejects a nickname for an admin that does not exist", async () => {
    const result = await actions.setNicknameAction({
      target: "admin:99",
      nickname: "Ghost",
    });

    expect(result).toEqual({
      status: "error",
      message: CHAT_MESSAGES.ADMIN_NOT_FOUND,
    });
  });

  it("keeps nicknames per conversation, even for trainees with the same name", async () => {
    await actions.setNicknameAction({ target: "pt", nickname: "Coach" });
    state.userId = otherUserId;
    await actions.setNicknameAction({ target: "pt", nickname: "Thầy" });
    asAdmin();

    const first = await actions.adminSetNicknameAction({
      conversationId,
      target: "pt",
      nickname: "Coach",
    });
    const rows = await db.select().from(chatNicknames);

    expect(first.status).toBe("success");
    expect(
      rows
        .map((row) => [row.conversationId, row.nickname])
        .sort((a, b) => Number(a[0]) - Number(b[0])),
    ).toEqual([
      [conversationId, "Coach"],
      [otherConversationId, "Thầy"],
    ]);
  });

  it("answers not found for an admin on an unknown conversation and rejects a bad id", async () => {
    asAdmin();

    expect(
      await actions.adminSetNicknameAction({
        conversationId: 9999,
        target: "user",
        nickname: "x",
      }),
    ).toEqual({
      status: "error",
      message: CHAT_MESSAGES.CONVERSATION_NOT_FOUND,
    });
    expect(
      await actions.adminSetNicknameAction({
        conversationId: -1,
        target: "user",
        nickname: "x",
      }),
    ).toEqual({ status: "error", message: CHAT_MESSAGES.INVALID_INPUT });
    expect(await db.select().from(chatNicknames)).toEqual([]);
  });

  it("is read-only while the chat is locked", async () => {
    await db.update(users).set({ chatEnabled: false });

    expect(
      await actions.setNicknameAction({ target: "pt", nickname: "x" }),
    ).toEqual({ status: "error", message: CHAT_MESSAGES.CHAT_LOCKED });
    asAdmin();
    expect(
      await actions.adminSetNicknameAction({
        conversationId,
        target: "pt",
        nickname: "x",
      }),
    ).toEqual({ status: "error", message: CHAT_MESSAGES.CHAT_LOCKED });
  });

  it("bumps the change cursor and publishes once per real change", async () => {
    expect(await cursor()).toBeNull();
    await actions.setNicknameAction({ target: "pt", nickname: "Coach" });
    const first = (await cursor())?.getTime() ?? 0;

    expect(first).toBeGreaterThan(0);
    expect(realtime.publishProfileUpdate).toHaveBeenCalledWith(conversationId);

    await actions.setNicknameAction({ target: "pt", nickname: "Coach" });
    await actions.setNicknameAction({ target: "user", nickname: "" });
    expect((await cursor())?.getTime()).toBe(first);
    expect(realtime.publishProfileUpdate).toHaveBeenCalledTimes(1);

    await actions.setNicknameAction({ target: "pt", nickname: "Boss" });
    expect((await cursor())?.getTime()).toBeGreaterThan(first);
    expect(await cursor(otherConversationId)).toBeNull();
  });

  it("lets any member name any member, themselves included, in both directions", async () => {
    // Trainee names PT side, a PT and themselves; admin 2 renames the trainee
    // and themselves; the trainee then renames the PT again.
    await actions.setNicknameAction({ target: "user", nickname: "Na" });
    await actions.setNicknameAction({ target: "admin:2", nickname: "Hai" });
    asAdmin(2);
    await actions.adminSetNicknameAction({
      conversationId,
      target: "user",
      nickname: "Bé Na",
    });
    await actions.adminSetNicknameAction({
      conversationId,
      target: "admin:2",
      nickname: "Coach Hai",
    });
    asUser();
    const result = await actions.setNicknameAction({
      target: "admin:2",
      nickname: "Thầy Hai",
    });
    const rows = await db.select().from(chatNicknames);

    expect(result).toMatchObject({
      status: "success",
      profile: { nicknames: { user: "Bé Na", "admin:2": "Thầy Hai" } },
    });
    expect(
      Object.fromEntries(rows.map((row) => [row.targetKey, row.setByKey])),
    ).toEqual({ user: "admin:2", "admin:2": "user" });
  });

  it("never lets a trainee reach another trainee's conversation", async () => {
    state.userId = otherUserId;
    await actions.setNicknameAction({ target: "user", nickname: "Của Bình" });

    const rows = await db.select().from(chatNicknames);

    expect(rows.map((row) => row.conversationId)).toEqual([
      otherConversationId,
    ]);
    expect(await cursor()).toBeNull();
  });

  it("rejects a PT outside the trainee's workspace, as a non-member", async () => {
    await db.update(admins).set({ role: "pt" }).where(eq(admins.id, 1));
    asAdmin(1);

    await expect(
      actions.adminSetNicknameAction({
        conversationId,
        target: "user",
        nickname: "Hack",
      }),
    ).rejects.toThrow();
    expect(await db.select().from(chatNicknames)).toEqual([]);
  });

  it("rejects an admin target that is not in this conversation's workspace", async () => {
    await db.update(admins).set({ role: "pt" }).where(eq(admins.id, 2));

    expect(
      await actions.setNicknameAction({ target: "admin:2", nickname: "Lạ" }),
    ).toEqual({ status: "error", message: CHAT_MESSAGES.ADMIN_NOT_FOUND });

    await db.update(users).set({ ptAdminId: 2 }).where(eq(users.id, userId));
    expect(
      (await actions.setNicknameAction({ target: "admin:2", nickname: "Hai" }))
        .status,
    ).toBe("success");
  });

  it("treats blank input as clear and clearing nothing as a no-op", async () => {
    await actions.setNicknameAction({ target: "pt", nickname: "Coach" });
    const cleared = await actions.setNicknameAction({
      target: "pt",
      nickname: "   ",
    });

    expect(cleared).toMatchObject({
      status: "success",
      profile: { nicknames: {} },
    });
    expect(await db.select().from(chatNicknames)).toEqual([]);
  });

  it("is silent: no chat message and no push, only the profile update", async () => {
    await actions.setNicknameAction({ target: "pt", nickname: "Coach" });
    asAdmin(1);
    await actions.adminSetNicknameAction({
      conversationId,
      target: "user",
      nickname: "Bé Na",
    });

    expect(await db.select().from(chatMessages)).toEqual([]);
    expect(push.schedulePush).not.toHaveBeenCalled();
    expect(push.scheduleReactionPush).not.toHaveBeenCalled();
    expect(push.sendChatPush).not.toHaveBeenCalled();
    expect(realtime.publishProfileUpdate).toHaveBeenCalledTimes(2);
  });
});

describe("loadAdminAccountColor", () => {
  it("returns the saved account colour, null when unset or unknown", async () => {
    const profile = await import("@/features/chat/services/chat-profile");

    expect(await profile.loadAdminAccountColor(1)).toBeNull();
    await db.update(admins).set({ chatColor: "teal" }).where(eq(admins.id, 1));
    expect(await profile.loadAdminAccountColor(1)).toBe("teal");
    expect(await profile.loadAdminAccountColor(2)).toBeNull();
    await db.update(admins).set({ chatColor: "mauve" }).where(eq(admins.id, 1));
    expect(await profile.loadAdminAccountColor(1)).toBeNull();
    expect(await profile.loadAdminAccountColor(999)).toBeNull();
  });
});

describe("colours", () => {
  it("saves the trainee's own colour and clears it with null", async () => {
    const set = await actions.setChatColorAction({ color: "teal" });

    expect(set).toMatchObject({
      status: "success",
      profile: { colors: { user: "teal" } },
    });
    expect(realtime.publishProfileUpdate).toHaveBeenCalledWith(conversationId);

    const cleared = await actions.setChatColorAction({ color: null });

    expect(cleared).toMatchObject({ profile: { colors: {} } });
    const [row] = await db.select().from(users).where(eq(users.id, userId));

    expect(row.chatColor).toBeNull();
  });

  it.each([
    ["a hex value", { color: "#ff0000" }],
    ["an unknown key", { color: "magenta" }],
    ["a number", { color: 3 }],
    ["no colour field", {}],
    ["null input", null],
  ])("rejects an invalid colour: %s", async (_label, input) => {
    const result = await actions.setChatColorAction(
      input as { color: string | null },
    );

    expect(result).toEqual({
      status: "error",
      message: CHAT_MESSAGES.COLOR_INVALID,
    });
    const [row] = await db.select().from(users).where(eq(users.id, userId));

    expect(row.chatColor).toBeNull();
  });

  it("does not touch another trainee's colour", async () => {
    await actions.setChatColorAction({ color: "red" });
    const [other] = await db
      .select()
      .from(users)
      .where(eq(users.id, otherUserId));

    expect(other.chatColor).toBeNull();
  });

  it("saves an admin's account colour and tells every conversation", async () => {
    asAdmin(1);
    const result = await actions.adminSetChatColorAction({ color: "purple" });

    expect(result).toEqual({ status: "success" });
    const [row] = await db.select().from(admins).where(eq(admins.id, 1));

    expect(row.chatColor).toBe("purple");
    expect(await cursor()).not.toBeNull();
    expect(await cursor(otherConversationId)).not.toBeNull();
    expect(realtime.publishProfileUpdate).toHaveBeenCalledTimes(2);
    expect(
      await actions.adminSetChatColorAction({ color: "nope" }),
    ).toMatchObject({ status: "error", message: CHAT_MESSAGES.COLOR_INVALID });
  });

  it("lets an admin override their colour for one conversation only", async () => {
    asAdmin(1);
    await actions.adminSetChatColorAction({ color: "purple" });
    const result = await actions.adminSetConversationColorAction({
      conversationId,
      color: "green",
    });

    expect(result).toMatchObject({
      status: "success",
      profile: { colors: { "admin:1": "green" } },
    });
    expect(await db.select().from(chatColorOverrides)).toEqual([
      { conversationId, adminId: 1, color: "green" },
    ]);

    // Replaces, does not duplicate.
    await actions.adminSetConversationColorAction({
      conversationId,
      color: "blue",
    });
    expect(await db.select().from(chatColorOverrides)).toHaveLength(1);

    // Other conversation still shows the account colour.
    const other = await adminRoute.GET(
      get(`/api/admin/chat/${otherConversationId}/messages`),
      {
        params: Promise.resolve({
          conversationId: String(otherConversationId),
        }),
      },
    );

    expect((await other.json()).profile.colors).toEqual({
      "admin:1": "purple",
    });

    // Removing the override falls back to the account colour.
    const removed = await actions.adminSetConversationColorAction({
      conversationId,
      color: null,
    });

    expect(removed).toMatchObject({
      profile: { colors: { "admin:1": "purple" } },
    });
    expect(await db.select().from(chatColorOverrides)).toEqual([]);
  });

  it("validates the override input and the conversation", async () => {
    asAdmin();

    expect(
      await actions.adminSetConversationColorAction({
        conversationId,
        color: "#fff",
      }),
    ).toEqual({ status: "error", message: CHAT_MESSAGES.COLOR_INVALID });
    expect(
      await actions.adminSetConversationColorAction({
        conversationId: 9999,
        color: "red",
      }),
    ).toEqual({
      status: "error",
      message: CHAT_MESSAGES.CONVERSATION_NOT_FOUND,
    });
    expect(await db.select().from(chatColorOverrides)).toEqual([]);
  });
});

describe("payload", () => {
  const thread = async (query = "") => {
    const response = await userRoute.GET(
      get(`/api/chat/messages${query ? `?${query}` : ""}`),
    );

    return {
      status: response.status,
      body: response.status === 204 ? null : await response.json(),
    };
  };

  it("is empty before anything is set", async () => {
    expect((await thread()).body.profile).toEqual({
      nicknames: {},
      colors: {},
    });
  });

  it("gives both sides the same colours AND the same shared nicknames, ignoring private aliases", async () => {
    const nick = (targetKey: string, nickname: string, setByKey: string) => ({
      conversationId,
      targetKey,
      nickname,
      setByKey,
      updatedAt: new Date(),
    });
    const alias = (ownerKey: string, targetKey: string, value: string) => ({
      ownerKey,
      targetKey,
      alias: value,
      updatedAt: new Date(),
    });

    await db.insert(chatNicknames).values([
      nick("pt", "Thầy", "user"),
      nick("user", "Bé Na", "admin:1"),
      nick("admin:2", "Thầy Hai", "user"),
      // Another conversation's nickname never leaks in.
      {
        ...nick("user", "Bé Bình", "admin:2"),
        conversationId: otherConversationId,
      },
    ]);
    // Private aliases are not used inside chat.
    await db
      .insert(contactAliases)
      .values([
        alias(`user:${userId}`, "pt", "Riêng của Na"),
        alias("admin:1", `user:${userId}`, "Riêng của admin 1"),
      ]);
    await actions.setChatColorAction({ color: "blue" });
    asAdmin(1);
    await actions.adminSetChatColorAction({ color: "red" });
    asAdmin(2);
    await actions.adminSetConversationColorAction({
      conversationId,
      color: "green",
    });
    const colors = { user: "blue", "admin:1": "red", "admin:2": "green" };
    const nicknames = { pt: "Thầy", user: "Bé Na", "admin:2": "Thầy Hai" };
    const viewAsAdmin = async (id: number) => {
      asAdmin(id);
      const response = await adminRoute.GET(
        get(`/api/admin/chat/${conversationId}/messages`),
        { params: Promise.resolve({ conversationId: String(conversationId) }) },
      );

      return (await response.json()).profile;
    };

    asUser();
    expect((await thread()).body.profile).toEqual({ nicknames, colors });
    expect(await viewAsAdmin(1)).toEqual({ nicknames, colors });
    expect(await viewAsAdmin(2)).toEqual({ nicknames, colors });
  });

  it("ignores a stored colour key that is no longer in the palette", async () => {
    await db.update(users).set({ chatColor: "retired" });

    expect((await thread()).body.profile.colors).toEqual({});
  });
});
