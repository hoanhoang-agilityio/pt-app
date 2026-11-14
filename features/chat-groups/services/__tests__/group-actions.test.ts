import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createTestDb, type TestDb } from "@/db/__tests__/create-test-db";
import {
  adminHiddenUsers,
  chatGroupMembers,
  chatGroupMessages,
  chatGroupPhotos,
  chatGroups,
  userRestrictions,
} from "@/db/schema";
import {
  seedAdmin,
  seedGroup,
  seedMessage,
  seedUser,
} from "@/features/chat-groups/services/__tests__/seed";

type Actor =
  | { kind: "admin"; id: number; role: "super_admin" | "pt" }
  | { kind: "user"; id: number; chatEnabled: boolean | null };

const state = vi.hoisted(() => ({
  db: null as unknown,
  actor: null as unknown,
  push: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/db", () => ({
  db: new Proxy(
    {},
    { get: (_target, property) => Reflect.get(state.db as object, property) },
  ),
}));
vi.mock("@/services/admin-lock", () => ({
  canSeeHiddenUsers: vi.fn(async () => false),
  isAdminLocked: vi.fn(async () => false),
}));
vi.mock("@/features/chat-groups/services/group-push", () => ({
  scheduleGroupPush: state.push,
}));
vi.mock("@/services/auth-guard", () => ({
  requireAdmin: vi.fn(async () => {
    const actor = state.actor as Actor;

    if (actor.kind !== "admin") {
      throw new Error("requireAdmin: no admin session");
    }
    return { id: actor.id, role: actor.role };
  }),
  requireUser: vi.fn(async () => {
    const actor = state.actor as Actor;

    if (actor.kind !== "user") {
      throw new Error("requireUser: no user session");
    }
    return { id: actor.id, chatEnabled: actor.chatEnabled, name: "x" };
  }),
}));

const actions = await import("@/features/chat-groups/services/group-actions");

let db: TestDb;
let superId: number;
let ptId: number;
let otherPtId: number;
let anId: number;
let binhId: number;

const asAdmin = (id: number, role: "super_admin" | "pt") => {
  state.actor = { kind: "admin", id, role } satisfies Actor;
};
const asUser = (id: number, chatEnabled: boolean | null = true) => {
  state.actor = { kind: "user", id, chatEnabled } satisfies Actor;
};

const memberRow = async (groupId: number, key: string) =>
  (
    await db
      .select()
      .from(chatGroupMembers)
      .where(
        and(
          eq(chatGroupMembers.groupId, groupId),
          eq(chatGroupMembers.memberKey, key),
        ),
      )
  )[0];

const lines = async (groupId: number) =>
  (
    await db
      .select()
      .from(chatGroupMessages)
      .where(
        and(
          eq(chatGroupMessages.groupId, groupId),
          eq(chatGroupMessages.kind, "system"),
        ),
      )
  ).map((row) => JSON.parse(row.systemEvent!) as { type: string });

beforeEach(async () => {
  vi.clearAllMocks();
  db = await createTestDb();
  state.db = db;
  superId = await seedAdmin(db, "Boss", "super_admin");
  ptId = await seedAdmin(db, "Coach", "pt");
  otherPtId = await seedAdmin(db, "Other", "pt");
  anId = await seedUser(db, "An", { ptAdminId: ptId });
  binhId = await seedUser(db, "Binh", { ptAdminId: otherPtId });
  asAdmin(superId, "super_admin");
});

describe("createGroupAction", () => {
  it("lets a super admin create a group with trainees and a PT", async () => {
    const result = await actions.createGroupAction({
      name: "  Lớp   sáng ",
      userIds: [anId, binhId],
      ptIds: [ptId],
    });

    expect(result).toMatchObject({ status: "success" });
    const groupId = (result as { groupId: number }).groupId;
    const [group] = await db.select().from(chatGroups);

    expect(group).toMatchObject({
      name: "Lớp sáng",
      createdByKey: `admin:${superId}`,
    });
    expect(
      (await db.select().from(chatGroupMembers))
        .map((row) => row.memberKey)
        .sort(),
    ).toEqual([`admin:${ptId}`, `user:${anId}`, `user:${binhId}`].sort());
    expect(await lines(groupId)).toEqual([
      {
        type: "member_added",
        actorKey: `admin:${superId}`,
        memberKeys: expect.any(Array),
      },
    ]);
  });

  it("adds a PT creator as an explicit member and keeps to their own trainees", async () => {
    const hiddenOwn = await seedUser(db, "Hidden", { ptAdminId: ptId });
    const ownVisible = await seedUser(db, "Own", { ptAdminId: ptId });

    await db
      .insert(adminHiddenUsers)
      .values({ adminId: ptId, userId: hiddenOwn });

    asAdmin(ptId, "pt");
    const result = (await actions.createGroupAction({
      name: "Nhóm của PT",
      userIds: [ownVisible, binhId, hiddenOwn],
      ptIds: [otherPtId],
    })) as { status: string; results: { id: number; outcome: string }[] };

    expect(
      Object.fromEntries(result.results.map((r) => [r.id, r.outcome])),
    ).toEqual({
      [ownVisible]: "added",
      [binhId]: "out_of_scope",
      [hiddenOwn]: "out_of_scope",
      [otherPtId]: "out_of_scope",
    });
    expect(
      (await db.select().from(chatGroupMembers))
        .map((row) => row.memberKey)
        .sort(),
    ).toEqual([`admin:${ptId}`, `user:${ownVisible}`].sort());
  });

  it("rejects an invalid name and creates nothing", async () => {
    expect(await actions.createGroupAction({ name: "   " })).toMatchObject({
      status: "error",
      message: "Tên nhóm cần từ 1 đến 60 ký tự",
    });
    expect(await db.select().from(chatGroups)).toHaveLength(0);
  });

  it("refuses a trainee session at the guard", async () => {
    asUser(anId);
    const result = await actions.createGroupAction({ name: "Nhóm" });

    expect(result.status).toBe("error");
    expect(await db.select().from(chatGroups)).toHaveLength(0);
  });
});

describe("addGroupMembersAction", () => {
  let groupId: number;

  beforeEach(async () => {
    groupId = await seedGroup(db, { createdByKey: `admin:${superId}` });
  });

  it("skips bad, unknown, duplicate and non-trainee ids per id", async () => {
    const result = (await actions.addGroupMembersAction({
      groupId,
      userIds: [anId, anId, 9999, -3, "x", null],
      ptIds: [superId, otherPtId],
    })) as { results: { id: unknown; outcome: string }[] };

    expect(result.results.map((r) => [r.id, r.outcome])).toEqual([
      [anId, "added"],
      [9999, "not_found"],
      [-3, "invalid"],
      ["x", "invalid"],
      [null, "invalid"],
      [superId, "not_trainee"],
      [otherPtId, "added"],
    ]);
  });

  it("reports an already active member and does not add a second row", async () => {
    await actions.addGroupMembersAction({ groupId, userIds: [anId] });
    const again = (await actions.addGroupMembersAction({
      groupId,
      userIds: [anId],
    })) as { results: { outcome: string }[] };

    expect(again.results[0].outcome).toBe("already_member");
    expect(await db.select().from(chatGroupMembers)).toHaveLength(1);
  });

  it("accepts 49 to 50 members and refuses 50 to 51", async () => {
    const ids = [];

    for (let i = 0; i < 49; i += 1) {
      ids.push(await seedUser(db, `Member${i}`));
    }
    await actions.addGroupMembersAction({ groupId, userIds: ids });
    expect(await db.select().from(chatGroupMembers)).toHaveLength(49);

    const result = (await actions.addGroupMembersAction({
      groupId,
      userIds: [anId, binhId],
    })) as { results: { id: number; outcome: string }[] };

    expect(result.results.map((r) => r.outcome)).toEqual([
      "added",
      "cap_reached",
    ]);
    expect(await db.select().from(chatGroupMembers)).toHaveLength(50);
    expect(
      await actions.addGroupMembersAction({ groupId, userIds: [binhId] }),
    ).toEqual({ status: "error", message: "Nhóm đã đủ 50 thành viên" });
    expect(await memberRow(groupId, `user:${binhId}`)).toBeUndefined();
  });

  it("does not count a super admin's state row against the cap", async () => {
    await actions.adminSetGroupMutedAction({ groupId, muted: true });
    expect(await memberRow(groupId, `admin:${superId}`)).toBeDefined();
    const ids = [];

    for (let i = 0; i < 50; i += 1) {
      ids.push(await seedUser(db, `Member${i}`));
    }
    await actions.addGroupMembersAction({ groupId, userIds: ids });
    const members = await db.select().from(chatGroupMembers);

    expect(members.filter((m) => m.memberKey.startsWith("user:"))).toHaveLength(
      50,
    );
  });

  it("counts a re-added member and keeps their read cursor", async () => {
    await actions.addGroupMembersAction({ groupId, userIds: [anId] });
    await db
      .update(chatGroupMembers)
      .set({
        leftAt: new Date(1000),
        removedByKey: "admin:1",
        lastReadMessageId: 7,
      })
      .where(eq(chatGroupMembers.memberKey, `user:${anId}`));
    const before = await memberRow(groupId, `user:${anId}`);

    const result = (await actions.addGroupMembersAction({
      groupId,
      userIds: [anId],
    })) as { results: { outcome: string }[] };
    const after = await memberRow(groupId, `user:${anId}`);

    expect(result.results[0].outcome).toBe("added");
    expect(after).toMatchObject({
      leftAt: null,
      removedByKey: null,
      lastReadMessageId: 7,
    });
    expect(after.joinedAt.getTime()).toBeGreaterThan(before.joinedAt.getTime());
    expect(await db.select().from(chatGroupMembers)).toHaveLength(1);
  });

  it("refuses a PT member who is not the creator and a stranger PT", async () => {
    const shared = await seedGroup(db, {
      createdByKey: `admin:${superId}`,
      members: [`admin:${ptId}`],
    });

    asAdmin(ptId, "pt");
    expect(
      await actions.addGroupMembersAction({ groupId: shared, userIds: [anId] }),
    ).toEqual({ status: "error", message: "Bạn không quản lý được nhóm này" });
    asAdmin(otherPtId, "pt");
    expect(
      await actions.addGroupMembersAction({ groupId: shared, userIds: [anId] }),
    ).toEqual({ status: "error", message: "Không tìm thấy nhóm chat này" });
  });

  it("answers not found for an unknown group instead of crashing", async () => {
    expect(
      await actions.addGroupMembersAction({ groupId: 4242, userIds: [anId] }),
    ).toMatchObject({
      status: "error",
      message: "Không tìm thấy nhóm chat này",
    });
    expect(await actions.addGroupMembersAction({ groupId: "x" })).toMatchObject(
      {
        status: "error",
        message: "Thông tin nhóm không hợp lệ",
      },
    );
  });
});

describe("remove, leave and rejoin", () => {
  let groupId: number;

  beforeEach(async () => {
    groupId = await seedGroup(db, {
      createdByKey: `admin:${ptId}`,
      members: [`admin:${ptId}`, `user:${anId}`, `user:${binhId}`],
    });
  });

  it("lets the creator PT remove a trainee with a removed line", async () => {
    asAdmin(ptId, "pt");
    expect(
      await actions.removeGroupMemberAction({
        groupId,
        memberKey: `user:${anId}`,
      }),
    ).toEqual({ status: "success" });
    expect(await memberRow(groupId, `user:${anId}`)).toMatchObject({
      removedByKey: `admin:${ptId}`,
    });
    expect((await memberRow(groupId, `user:${anId}`)).leftAt).not.toBeNull();
    expect(await lines(groupId)).toEqual([
      {
        type: "member_removed",
        actorKey: `admin:${ptId}`,
        memberKey: `user:${anId}`,
      },
    ]);
  });

  it("refuses to remove a super admin and a non-member", async () => {
    asAdmin(ptId, "pt");
    expect(
      await actions.removeGroupMemberAction({
        groupId,
        memberKey: `admin:${superId}`,
      }),
    ).toEqual({
      status: "error",
      message: "Không thể xoá quản lý tổng khỏi nhóm",
    });
    expect(
      await actions.removeGroupMemberAction({ groupId, memberKey: "user:999" }),
    ).toEqual({
      status: "error",
      message: "Không tìm thấy thành viên này trong nhóm",
    });
  });

  it("lets a trainee leave, keeps history and cursor, and blocks them until re-added", async () => {
    await seedMessage(db, groupId, `admin:${ptId}`, "hello");
    await db
      .update(chatGroupMembers)
      .set({ lastReadMessageId: 1 })
      .where(eq(chatGroupMembers.memberKey, `user:${anId}`));
    asUser(anId);

    expect(await actions.leaveGroupAction({ groupId })).toEqual({
      status: "success",
    });
    const row = await memberRow(groupId, `user:${anId}`);

    expect(row.leftAt).not.toBeNull();
    expect(row.removedByKey).toBeNull();
    expect(row.lastReadMessageId).toBe(1);
    expect(await lines(groupId)).toEqual([
      { type: "member_left", memberKey: `user:${anId}` },
    ]);
    expect(await db.select().from(chatGroupMessages)).toHaveLength(2);
    // Out of the group: nothing works for them any more.
    expect(await actions.leaveGroupAction({ groupId })).toMatchObject({
      status: "error",
      message: "Không tìm thấy nhóm chat này",
    });
    expect(
      await actions.sendGroupMessageAction({
        groupId,
        clientId: crypto.randomUUID(),
        body: "hi",
      }),
    ).toMatchObject({ status: "error" });
    // Only an admin who manages can bring them back.
    asAdmin(ptId, "pt");
    await actions.addGroupMembersAction({ groupId, userIds: [anId] });
    asUser(anId);
    expect(
      await actions.sendGroupMessageAction({
        groupId,
        clientId: crypto.randomUUID(),
        body: "back",
      }),
    ).toMatchObject({ status: "success" });
  });

  it("does not let a super admin leave", async () => {
    asAdmin(superId, "super_admin");
    expect(await actions.adminLeaveGroupAction({ groupId })).toEqual({
      status: "error",
      message: "Quản lý tổng không thể rời nhóm",
    });
  });

  it("lets a PT member leave", async () => {
    asAdmin(ptId, "pt");
    expect(await actions.adminLeaveGroupAction({ groupId })).toEqual({
      status: "success",
    });
    expect((await memberRow(groupId, `admin:${ptId}`)).leftAt).not.toBeNull();
  });
});

describe("rename, managers-only, avatar", () => {
  let groupId: number;

  beforeEach(async () => {
    groupId = await seedGroup(db, {
      createdByKey: `admin:${ptId}`,
      name: "Cũ",
      members: [`admin:${ptId}`, `admin:${otherPtId}`, `user:${anId}`],
    });
  });

  it("renames with a trimmed name and one line, and a same name is a no-op", async () => {
    asAdmin(ptId, "pt");
    await actions.renameGroupAction({ groupId, name: "  Mới  " });
    await actions.renameGroupAction({ groupId, name: "Mới" });

    expect((await db.select().from(chatGroups))[0].name).toBe("Mới");
    expect(await lines(groupId)).toEqual([
      { type: "renamed", actorKey: `admin:${ptId}`, from: "Cũ", to: "Mới" },
    ]);
    expect(
      await actions.renameGroupAction({ groupId, name: "x".repeat(61) }),
    ).toMatchObject({ status: "error" });
  });

  it("lets only managers change the group", async () => {
    asAdmin(otherPtId, "pt");
    for (const result of [
      await actions.renameGroupAction({ groupId, name: "Hack" }),
      await actions.setGroupManagersOnlyAction({ groupId, enabled: true }),
      await actions.setGroupAvatarAction({ groupId, dataUrl: null }),
    ]) {
      expect(result).toEqual({
        status: "error",
        message: "Bạn không quản lý được nhóm này",
      });
    }
    expect((await db.select().from(chatGroups))[0]).toMatchObject({
      name: "Cũ",
      managersOnly: null,
    });
  });

  it("switches managers-only once per change with a line", async () => {
    asAdmin(superId, "super_admin");
    await actions.setGroupManagersOnlyAction({ groupId, enabled: true });
    await actions.setGroupManagersOnlyAction({ groupId, enabled: true });
    await actions.setGroupManagersOnlyAction({ groupId, enabled: false });

    expect((await lines(groupId)).map((l) => l.type)).toEqual([
      "managers_only",
      "managers_only",
    ]);
    expect((await db.select().from(chatGroups))[0].managersOnly).toBe(false);
  });

  it("stores a valid photo and refuses an invalid one", async () => {
    const png = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3,
    ]).toString("base64");

    asAdmin(superId, "super_admin");
    expect(
      await actions.setGroupAvatarAction({
        groupId,
        dataUrl: `data:image/png;base64,${png}`,
      }),
    ).toEqual({ status: "success" });
    const [group] = await db.select().from(chatGroups);

    expect(group.avatar).toBe(`data:image/png;base64,${png}`);
    expect(group.avatarUpdatedAt).not.toBeNull();
    expect(
      await actions.setGroupAvatarAction({
        groupId,
        dataUrl: "data:text/html,",
      }),
    ).toMatchObject({ status: "error" });
    await actions.setGroupAvatarAction({ groupId, dataUrl: null });
    expect((await db.select().from(chatGroups))[0].avatar).toBeNull();
  });
});

describe("mute and read cursor", () => {
  let groupId: number;
  let lastId: number;

  beforeEach(async () => {
    groupId = await seedGroup(db, {
      createdByKey: `admin:${superId}`,
      members: [`user:${anId}`],
    });
    await seedMessage(db, groupId, `admin:${superId}`, "one");
    lastId = await seedMessage(db, groupId, `admin:${superId}`, "two");
  });

  it("mutes and unmutes a trainee's own row", async () => {
    asUser(anId);
    await actions.setGroupMutedAction({ groupId, muted: true });
    expect((await memberRow(groupId, `user:${anId}`)).mutedAt).not.toBeNull();
    await actions.setGroupMutedAction({ groupId, muted: false });
    expect((await memberRow(groupId, `user:${anId}`)).mutedAt).toBeNull();
  });

  it("moves the cursor forward only and never past the newest message", async () => {
    asUser(anId);
    await actions.markGroupReadAction({ groupId, lastReadMessageId: 1 });
    expect((await memberRow(groupId, `user:${anId}`)).lastReadMessageId).toBe(
      1,
    );
    await actions.markGroupReadAction({ groupId, lastReadMessageId: 999 });
    expect((await memberRow(groupId, `user:${anId}`)).lastReadMessageId).toBe(
      lastId,
    );
    await actions.markGroupReadAction({ groupId, lastReadMessageId: 1 });
    expect((await memberRow(groupId, `user:${anId}`)).lastReadMessageId).toBe(
      lastId,
    );
  });

  it("creates the state row of a super admin lazily and keeps the group's members unchanged", async () => {
    expect(await memberRow(groupId, `admin:${superId}`)).toBeUndefined();
    await actions.adminMarkGroupReadAction({
      groupId,
      lastReadMessageId: lastId,
    });
    expect(
      (await memberRow(groupId, `admin:${superId}`)).lastReadMessageId,
    ).toBe(lastId);
  });

  it("answers not found for a group the trainee is not in", async () => {
    const other = await seedGroup(db, { createdByKey: `admin:${superId}` });

    asUser(anId);
    expect(
      await actions.markGroupReadAction({
        groupId: other,
        lastReadMessageId: 1,
      }),
    ).toMatchObject({
      status: "error",
      message: "Không tìm thấy nhóm chat này",
    });
  });
});

describe("sending", () => {
  let groupId: number;

  beforeEach(async () => {
    groupId = await seedGroup(db, {
      createdByKey: `admin:${ptId}`,
      members: [`admin:${ptId}`, `user:${anId}`],
    });
    asUser(anId);
  });

  const send = (extra: Record<string, unknown> = {}) =>
    actions.sendGroupMessageAction({
      groupId,
      clientId: crypto.randomUUID(),
      body: "Chào cả nhóm",
      ...extra,
    });

  it("stores the message, moves the inbox pointer and pushes once", async () => {
    const result = (await send()) as {
      status: string;
      message: {
        id: number;
        senderName: string;
        body: string;
        senderKey: string;
      };
      created: boolean;
    };

    expect(result.status).toBe("success");
    expect(result.message).toMatchObject({
      senderKey: `user:${anId}`,
      senderName: "An",
      body: "Chào cả nhóm",
    });
    expect((await db.select().from(chatGroups))[0].lastMessageId).toBe(
      result.message.id,
    );
    expect(state.push).toHaveBeenCalledTimes(1);
    expect(state.push).toHaveBeenCalledWith(
      expect.objectContaining({
        groupId,
        senderKey: `user:${anId}`,
        body: "Chào cả nhóm",
      }),
    );
  });

  it("is idempotent on the clientId: one row, no second push", async () => {
    const clientId = crypto.randomUUID();
    const first = (await send({ clientId })) as { message: { id: number } };
    const retry = (await send({ clientId })) as {
      message: { id: number };
      created: boolean;
    };

    expect(retry.message.id).toBe(first.message.id);
    expect(retry.created).toBe(false);
    expect(
      (await db.select().from(chatGroupMessages)).filter(
        (row) => row.kind === "message",
      ),
    ).toHaveLength(1);
    expect(state.push).toHaveBeenCalledTimes(1);
  });

  it("stores /imlang as silent and sends no push", async () => {
    const result = (await send({ body: "/imlang ngủ đi" })) as {
      message: { body: string; silent: boolean };
    };

    expect(result.message).toMatchObject({ body: "ngủ đi", silent: true });
    expect(state.push).not.toHaveBeenCalled();
  });

  it("stores a bundled sticker without text", async () => {
    const result = (await actions.sendGroupMessageAction({
      groupId,
      clientId: crypto.randomUUID(),
      sticker: { pack: "fluent", id: "fire" },
    })) as { message: { body: string; sticker: { ref: string } } };

    expect(result.message.body).toBe("");
    expect(result.message.sticker.ref).toBe("pack:fire");
  });

  it("blocks a trainee under managers-only but not the PT", async () => {
    await db.update(chatGroups).set({ managersOnly: true });
    expect(await send()).toEqual({
      status: "error",
      message: "Nhóm này chỉ cho quản lý nhắn tin",
    });
    asAdmin(ptId, "pt");
    expect(
      await actions.adminSendGroupMessageAction({
        groupId,
        clientId: crypto.randomUUID(),
        body: "Thông báo",
      }),
    ).toMatchObject({ status: "success" });
    asAdmin(superId, "super_admin");
    expect(
      await actions.adminSendGroupMessageAction({
        groupId,
        clientId: crypto.randomUUID(),
        body: "Từ quản lý tổng",
      }),
    ).toMatchObject({
      status: "success",
      message: { senderTag: "manager" },
    });
  });

  it("blocks chat off and a restricted trainee, with nothing stored", async () => {
    asUser(anId, false);
    expect(await send()).toEqual({
      status: "error",
      message: "PT đã tạm khoá nhắn tin",
    });
    asUser(anId, true);
    await db.insert(userRestrictions).values({
      userId: anId,
      level: "restricted",
      createdByAdminId: superId,
      createdAt: new Date(),
    });
    expect(await send()).toMatchObject({
      status: "error",
      message: expect.stringContaining("bị hạn chế"),
    });
    expect(await db.select().from(chatGroupMessages)).toHaveLength(0);
    expect(state.push).not.toHaveBeenCalled();
  });

  it("answers not found for a dissolved group, even to a member", async () => {
    await db.update(chatGroups).set({ dissolvedAt: new Date() });
    expect(await send()).toMatchObject({
      status: "error",
      message: "Không tìm thấy nhóm chat này",
    });
  });

  it("replies only to a message of the same group", async () => {
    const otherGroup = await seedGroup(db, {
      createdByKey: `admin:${superId}`,
      members: [`user:${anId}`],
    });
    const foreign = await seedMessage(
      db,
      otherGroup,
      `user:${anId}`,
      "elsewhere",
    );
    const local = await seedMessage(db, groupId, `admin:${ptId}`, "here");

    expect(await send({ replyToMessageId: foreign })).toMatchObject({
      status: "error",
    });
    expect(await send({ replyToMessageId: 9999 })).toMatchObject({
      status: "error",
    });
    expect(await send({ replyToMessageId: local })).toMatchObject({
      status: "success",
      message: { replyTo: { id: local, snippet: "here" } },
    });
  });

  it("attaches the sender's own pending photo once, to this group only", async () => {
    const photo = async (groupIdOf: number, uploaderKey: string) =>
      (
        await db
          .insert(chatGroupPhotos)
          .values({
            groupId: groupIdOf,
            uploaderKey,
            mime: "image/webp",
            width: 1,
            height: 1,
            data: Buffer.from([1]),
            size: 1,
            createdAt: new Date(),
          })
          .returning({ id: chatGroupPhotos.id })
      )[0].id;
    const mine = await photo(groupId, `user:${anId}`);
    const theirs = await photo(groupId, `admin:${ptId}`);
    const elsewhere = await photo(groupId + 1, `user:${anId}`);

    expect(await send({ body: undefined, photoId: theirs })).toMatchObject({
      status: "error",
    });
    expect(await send({ body: undefined, photoId: elsewhere })).toMatchObject({
      status: "error",
    });
    const result = await send({ body: "caption", photoId: mine });

    expect(result).toMatchObject({
      status: "success",
      message: { photoId: mine, body: "caption" },
    });
    expect(
      (await db.select().from(chatGroupPhotos)).find((row) => row.id === mine)
        ?.messageId,
    ).not.toBeNull();
    expect(state.push).toHaveBeenCalledWith(
      expect.objectContaining({ photo: true }),
    );
    // Already attached: a second message cannot reuse it.
    expect(await send({ photoId: mine })).toMatchObject({ status: "error" });
  });

  it("rejects bad input without storing anything", async () => {
    for (const input of [
      {},
      { groupId, clientId: "not-a-uuid", body: "x" },
      { groupId, clientId: crypto.randomUUID() },
      { groupId: 0, clientId: crypto.randomUUID(), body: "x" },
    ]) {
      expect(await actions.sendGroupMessageAction(input)).toMatchObject({
        status: "error",
      });
    }
    expect(await db.select().from(chatGroupMessages)).toHaveLength(0);
  });

  it("does not let a clientId used by someone else return their message", async () => {
    const clientId = crypto.randomUUID();

    await send({ clientId });
    asAdmin(superId, "super_admin");
    expect(
      await actions.adminSendGroupMessageAction({
        groupId,
        clientId,
        body: "mine",
      }),
    ).toMatchObject({ status: "error" });
  });
});
