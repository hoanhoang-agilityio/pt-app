import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createTestDb, type TestDb } from "@/db/__tests__/create-test-db";
import { chatGroupMembers, chatGroupMessages, chatGroups } from "@/db/schema";
import {
  seedAdmin,
  seedGroup,
  seedMessage,
  seedUser,
} from "@/features/chat-groups/services/__tests__/seed";
import {
  parseSystemEvent,
  type PtChangeEvent,
} from "@/features/chat-groups/utils/system-event";

const state = vi.hoisted(() => ({ db: null as unknown, adminId: 0 }));

vi.mock("server-only", () => ({}));
vi.mock("@/db", () => ({
  db: new Proxy(
    {},
    { get: (_target, property) => Reflect.get(state.db as object, property) },
  ),
}));
vi.mock("@/services/auth-guard", () => ({
  requireSuperAdmin: vi.fn(async () => ({
    id: state.adminId,
    role: "super_admin",
  })),
}));

const access = await import("@/features/chat-groups/services/group-access");
const queries = await import("@/features/chat-groups/services/group-queries");
const lines =
  await import("@/features/chat-groups/services/group-system-lines");
const adminActions =
  await import("@/features/chat-groups/services/group-admin-actions");

let db: TestDb;
let superId: number;
let secondSuperId: number;
let oldPt: number;
let newPt: number;
let anId: number;
let groupId: number;

const alertsOf = async (id = groupId) =>
  (
    await db
      .select()
      .from(chatGroupMessages)
      .where(eq(chatGroupMessages.groupId, id))
  )
    .filter((row) => row.audience === "super_admin")
    .map((row) => ({ id: row.id, event: parseSystemEvent(row.systemEvent) }));

beforeEach(async () => {
  db = await createTestDb();
  state.db = db;
  superId = await seedAdmin(db, "Boss", "super_admin");
  secondSuperId = await seedAdmin(db, "Boss2", null);
  oldPt = await seedAdmin(db, "OldPt", "pt");
  newPt = await seedAdmin(db, "NewPt", "pt");
  anId = await seedUser(db, "An", { ptAdminId: oldPt });
  groupId = await seedGroup(db, {
    createdByKey: `admin:${superId}`,
    members: [`user:${anId}`],
  });
  state.adminId = superId;
});

describe("appendSystemLine", () => {
  it("moves the inbox pointer for a line everyone reads, not for an alert", async () => {
    const id = await lines.appendSystemLine(groupId, {
      type: "member_left",
      memberKey: `user:${anId}`,
    });

    expect((await db.select().from(chatGroups))[0].lastMessageId).toBe(id);
    await lines.appendSystemLine(
      groupId,
      {
        type: "pt_changed",
        userId: anId,
        fromPtId: oldPt,
        toPtId: newPt,
        resolution: null,
      },
      { audience: "super_admin" },
    );
    expect((await db.select().from(chatGroups))[0].lastMessageId).toBe(id);
  });

  it("refuses to store an invalid event", async () => {
    await expect(
      lines.appendSystemLine(groupId, {
        type: "member_left",
        memberKey: "nonsense",
      }),
    ).rejects.toThrow();
    expect(await db.select().from(chatGroupMessages)).toHaveLength(0);
  });
});

describe("recordPtChangeInGroups", () => {
  it("writes one super-admin-only alert per active group that has the trainee", async () => {
    const second = await seedGroup(db, {
      createdByKey: `admin:${superId}`,
      members: [`user:${anId}`],
    });
    const without = await seedGroup(db, { createdByKey: `admin:${superId}` });
    const left = await seedGroup(db, {
      createdByKey: `admin:${superId}`,
      members: [`user:${anId}`],
    });
    const dissolved = await seedGroup(db, {
      createdByKey: `admin:${superId}`,
      members: [`user:${anId}`],
      dissolved: true,
    });

    await db
      .update(chatGroupMembers)
      .set({ leftAt: new Date() })
      .where(eq(chatGroupMembers.groupId, left));

    expect(await lines.recordPtChangeInGroups(anId, oldPt, newPt)).toBe(2);
    for (const id of [groupId, second]) {
      expect(await alertsOf(id)).toEqual([
        {
          id: expect.any(Number),
          event: {
            type: "pt_changed",
            userId: anId,
            fromPtId: oldPt,
            toPtId: newPt,
            resolution: null,
          },
        },
      ]);
    }
    for (const id of [without, left, dissolved]) {
      expect(await alertsOf(id)).toEqual([]);
    }
  });

  it("writes nothing when the value did not change", async () => {
    expect(await lines.recordPtChangeInGroups(anId, oldPt, oldPt)).toBe(0);
    expect(await lines.recordPtChangeInGroups(anId, null, null)).toBe(0);
    expect(await alertsOf()).toEqual([]);
  });

  it("supersedes an older unresolved alert for the same trainee and keeps resolved ones", async () => {
    await lines.recordPtChangeInGroups(anId, oldPt, newPt);
    await lines.recordPtChangeInGroups(anId, newPt, null);
    const alerts = await alertsOf();

    expect(alerts).toHaveLength(2);
    expect((alerts[0].event as PtChangeEvent).resolution).toMatchObject({
      choice: "superseded",
      byAdminId: null,
    });
    expect((alerts[1].event as PtChangeEvent).resolution).toBeNull();
  });

  it("does not supersede another trainee's alert", async () => {
    const binhId = await seedUser(db, "Binh");

    await db.insert(chatGroupMembers).values({
      groupId,
      memberKey: `user:${binhId}`,
      addedByKey: `admin:${superId}`,
      joinedAt: new Date(),
    });
    await lines.recordPtChangeInGroups(binhId, null, newPt);
    await lines.recordPtChangeInGroups(anId, oldPt, newPt);

    expect(
      (await alertsOf()).map((a) => (a.event as PtChangeEvent).resolution),
    ).toEqual([null, null]);
  });

  it("never reaches the trainee, a PT, the unread count, the preview or seen-by", async () => {
    const message = await seedMessage(db, groupId, `admin:${superId}`, "hi");

    await lines.recordPtChangeInGroups(anId, oldPt, newPt);
    const alert = (await alertsOf())[0];
    const trainee = (await access.loadGroupActor(
      groupId,
      access.sessionOfUser({ id: anId }),
    ))!;
    const superActor = (await access.loadGroupActor(
      groupId,
      access.sessionOfAdmin({ id: superId, role: "super_admin" }),
    ))!;

    expect(
      (await queries.listGroupMessages(groupId, trainee.actor)).messages.map(
        (m) => m.id,
      ),
    ).toEqual([message]);
    expect(
      (await queries.listGroupMessages(groupId, superActor.actor)).messages.map(
        (m) => m.id,
      ),
    ).toEqual([message, alert.id]);
    expect(
      (await queries.countGroupUnread(access.sessionOfUser({ id: anId })))
        .total,
    ).toBe(1);
    expect(
      (
        await queries.countGroupUnread(
          access.sessionOfAdmin({ id: superId, role: "super_admin" }),
        )
      ).total,
    ).toBe(0);
    expect(
      (
        await queries.listGroupsForSession(access.sessionOfUser({ id: anId }))
      )[0].lastMessage?.id,
    ).toBe(message);
    expect(
      await queries.listSeenBy(groupId, alert.id, superActor.actor),
    ).toBeNull();
  });
});

describe("resolvePtChangeAlertAction", () => {
  let alertId: number;

  beforeEach(async () => {
    await lines.recordPtChangeInGroups(anId, oldPt, newPt);
    alertId = (await alertsOf())[0].id;
  });

  const resolve = (choice: "keep" | "remove", id = alertId) =>
    adminActions.resolvePtChangeAlertAction({
      groupId,
      messageId: id,
      choice,
    });
  const resolution = async () =>
    (
      (await alertsOf()).filter((a) => a.id === alertId)[0]
        .event as PtChangeEvent
    ).resolution;

  it("keeps the trainee and records who chose", async () => {
    expect(await resolve("keep")).toEqual({ status: "success" });
    expect(await resolution()).toMatchObject({
      choice: "keep",
      byAdminId: superId,
    });
    expect((await db.select().from(chatGroupMembers))[0].leftAt).toBeNull();
  });

  it("removes the trainee with the normal removed line", async () => {
    expect(await resolve("remove")).toEqual({ status: "success" });
    expect(await resolution()).toMatchObject({ choice: "remove" });
    const [member] = await db.select().from(chatGroupMembers);

    expect(member.leftAt).not.toBeNull();
    expect(member.removedByKey).toBe(`admin:${superId}`);
    const removed = (await db.select().from(chatGroupMessages))
      .map((row) => parseSystemEvent(row.systemEvent))
      .filter((event) => event?.type === "member_removed");

    expect(removed).toEqual([
      {
        type: "member_removed",
        actorKey: `admin:${superId}`,
        memberKey: `user:${anId}`,
      },
    ]);
  });

  it("resolves once: a second tap and a second super admin are told who handled it", async () => {
    await resolve("keep");
    expect(await resolve("keep")).toMatchObject({
      status: "error",
      message: "Cảnh báo này đã được xử lý",
      handledBy: "Boss",
    });
    state.adminId = secondSuperId;
    expect(await resolve("remove")).toMatchObject({
      status: "error",
      handledBy: "Boss",
    });
    expect(await resolution()).toMatchObject({ choice: "keep" });
    expect((await db.select().from(chatGroupMembers))[0].leftAt).toBeNull();
  });

  it("lets only one of two concurrent resolves win", async () => {
    const results = await Promise.all([resolve("keep"), resolve("remove")]);

    expect(results.filter((r) => r.status === "success")).toHaveLength(1);
    expect(results.filter((r) => r.status === "error")).toHaveLength(1);
  });

  it("refuses an alert that was superseded by a newer change", async () => {
    await lines.recordPtChangeInGroups(anId, newPt, null);

    expect(await resolve("keep")).toMatchObject({
      status: "error",
      message: "Cảnh báo này đã được xử lý",
    });
    const newest = (await alertsOf())[1];

    expect(await resolve("keep", newest.id)).toEqual({ status: "success" });
  });

  it("answers not found for an ordinary line, a message of another group and bad ids", async () => {
    const ordinary = await seedMessage(db, groupId, `admin:${superId}`, "hi");
    const line = await lines.appendSystemLine(groupId, {
      type: "member_left",
      memberKey: `user:${anId}`,
    });
    const other = await seedGroup(db, { createdByKey: `admin:${superId}` });

    for (const id of [ordinary, line, 9999]) {
      expect(await resolve("keep", id)).toEqual({
        status: "error",
        message: "Không tìm thấy cảnh báo này",
      });
    }
    expect(
      await adminActions.resolvePtChangeAlertAction({
        groupId: other,
        messageId: alertId,
        choice: "keep",
      }),
    ).toMatchObject({
      status: "error",
      message: "Không tìm thấy cảnh báo này",
    });
    expect(
      await adminActions.resolvePtChangeAlertAction({
        groupId: 0,
        messageId: alertId,
        choice: "nope",
      }),
    ).toMatchObject({
      status: "error",
      message: "Thông tin nhóm không hợp lệ",
    });
    expect(await resolution()).toBeNull();
  });
});

describe("dissolveGroupAction", () => {
  it("dissolves softly, keeps the data and hides the group from members", async () => {
    await seedMessage(db, groupId, `user:${anId}`, "hi");

    expect(await adminActions.dissolveGroupAction({ groupId })).toEqual({
      status: "success",
    });
    const [group] = await db.select().from(chatGroups);

    expect(group.dissolvedAt).not.toBeNull();
    expect(group.dissolvedByAdminId).toBe(superId);
    expect(await db.select().from(chatGroupMessages)).toHaveLength(1);
    expect(
      await access.loadGroupActor(groupId, access.sessionOfUser({ id: anId })),
    ).toBeNull();
    expect(
      await queries.listGroupsForSession(access.sessionOfUser({ id: anId })),
    ).toEqual([]);
    // A super admin can still open it by id.
    expect(
      await access.loadGroupActor(
        groupId,
        access.sessionOfAdmin({ id: superId, role: "super_admin" }),
      ),
    ).not.toBeNull();
  });

  it("is a no-op the second time and answers not found for an unknown group", async () => {
    await adminActions.dissolveGroupAction({ groupId });
    const first = (await db.select().from(chatGroups))[0].dissolvedAt;

    await adminActions.dissolveGroupAction({ groupId });
    expect((await db.select().from(chatGroups))[0].dissolvedAt).toEqual(first);
    expect(await adminActions.dissolveGroupAction({ groupId: 777 })).toEqual({
      status: "error",
      message: "Không tìm thấy nhóm chat này",
    });
    expect(
      await adminActions.dissolveGroupAction({ groupId: "x" }),
    ).toMatchObject({ status: "error" });
  });
});
