import { beforeEach, describe, expect, it, vi } from "vitest";

import { createTestDb, type TestDb } from "@/db/__tests__/create-test-db";
import { userRestrictions } from "@/db/schema";
import {
  seedAdmin,
  seedGroup,
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

const access = await import("@/features/chat-groups/services/group-access");

let db: TestDb;
let superId: number;
let ptId: number;
let otherPtId: number;
let traineeId: number;
let outsiderId: number;
let groupId: number;

beforeEach(async () => {
  db = await createTestDb();
  state.db = db;
  // The first admin has role null: a super admin created before roles existed.
  superId = await seedAdmin(db, "Boss", null);
  ptId = await seedAdmin(db, "Coach", "pt");
  otherPtId = await seedAdmin(db, "Other", "pt");
  traineeId = await seedUser(db, "An");
  outsiderId = await seedUser(db, "Binh");
  groupId = await seedGroup(db, {
    createdByKey: `admin:${ptId}`,
    members: [`admin:${ptId}`, `user:${traineeId}`],
  });
});

const asSuper = () => access.sessionOfAdmin({ id: superId, role: null });
const asPt = (id = ptId) => access.sessionOfAdmin({ id, role: "pt" });
const asUser = (id = traineeId) => access.sessionOfUser({ id });

describe("loadGroupActor", () => {
  it("treats an admin with role null as an implicit super admin member", async () => {
    const context = await access.loadGroupActor(groupId, asSuper());

    expect(context?.actor).toMatchObject({
      key: `admin:${superId}`,
      role: "super_admin",
      isMember: true,
      canManage: true,
    });
  });

  it("builds the actor of the creator PT, a trainee member", async () => {
    expect((await access.loadGroupActor(groupId, asPt()))?.actor).toMatchObject(
      { role: "pt", canManage: true, isManager: true },
    );
    expect(
      (await access.loadGroupActor(groupId, asUser()))?.actor,
    ).toMatchObject({ role: "trainee", canManage: false, isManager: false });
  });

  it.each([
    ["a non-member trainee", () => asUser(outsiderId)],
    ["a PT who is not a member", () => asPt(otherPtId)],
  ])("answers null for %s", async (_name, session) => {
    expect(await access.loadGroupActor(groupId, session())).toBeNull();
  });

  it.each([0, -1, "abc", "1.5", 999, undefined, null])(
    "answers null for the bad or unknown group id %s",
    async (id) => {
      expect(await access.loadGroupActor(id, asSuper())).toBeNull();
    },
  );

  it("answers null once a member left, and again after a rejoin it answers", async () => {
    const { chatGroupMembers } = await import("@/db/schema");
    const { eq } = await import("drizzle-orm");

    await db
      .update(chatGroupMembers)
      .set({ leftAt: new Date() })
      .where(eq(chatGroupMembers.memberKey, `user:${traineeId}`));
    expect(await access.loadGroupActor(groupId, asUser())).toBeNull();
    await db
      .update(chatGroupMembers)
      .set({ leftAt: null })
      .where(eq(chatGroupMembers.memberKey, `user:${traineeId}`));
    expect(await access.loadGroupActor(groupId, asUser())).not.toBeNull();
  });

  it("hides a dissolved group from everyone but a super admin", async () => {
    const dissolved = await seedGroup(db, {
      createdByKey: `admin:${ptId}`,
      members: [`admin:${ptId}`, `user:${traineeId}`],
      dissolved: true,
    });

    expect(await access.loadGroupActor(dissolved, asUser())).toBeNull();
    expect(await access.loadGroupActor(dissolved, asPt())).toBeNull();
    expect(await access.loadGroupActor(dissolved, asSuper())).not.toBeNull();
  });
});

describe("resolveSendBlock", () => {
  const resolve = async (
    session: ReturnType<typeof asUser>,
    user: { id: number; chatEnabled: boolean | null } | null,
    extra: { ignoreManagersOnly?: boolean; allowRestricted?: boolean } = {},
  ) => {
    const context = (await access.loadGroupActor(groupId, session))!;

    return access.resolveSendBlock({ ...context, user, ...extra });
  };

  it("lets an enabled trainee send", async () => {
    expect(
      await resolve(asUser(), { id: traineeId, chatEnabled: true }),
    ).toBeNull();
  });

  it("blocks a trainee whose chat is off with the coach chat message", async () => {
    expect(
      await resolve(asUser(), { id: traineeId, chatEnabled: false }),
    ).toEqual({
      reason: "chat_off",
      message: "PT đã tạm khoá nhắn tin",
    });
  });

  it("blocks a restricted trainee through the block-user check, but allows unsend", async () => {
    await db.insert(userRestrictions).values({
      userId: traineeId,
      level: "restricted",
      createdByAdminId: superId,
      createdAt: new Date(),
    });
    const user = { id: traineeId, chatEnabled: true };

    expect(await resolve(asUser(), user)).toMatchObject({
      reason: "restricted",
    });
    expect(await resolve(asUser(), user, { allowRestricted: true })).toBeNull();
  });

  it("applies managers-only to trainees only, and lets reactions through", async () => {
    const { chatGroups } = await import("@/db/schema");

    await db.update(chatGroups).set({ managersOnly: true });
    const user = { id: traineeId, chatEnabled: true };

    expect(await resolve(asUser(), user)).toMatchObject({
      reason: "managers_only",
    });
    expect(
      await resolve(asUser(), user, { ignoreManagersOnly: true }),
    ).toBeNull();
    expect(await resolve(asPt(), null)).toBeNull();
    expect(await resolve(asSuper(), null)).toBeNull();
  });

  it("blocks writes into a dissolved group even for a super admin", async () => {
    const dissolved = await seedGroup(db, {
      createdByKey: `admin:${ptId}`,
      dissolved: true,
    });
    const context = (await access.loadGroupActor(dissolved, asSuper()))!;

    expect(
      await access.resolveSendBlock({ ...context, user: null }),
    ).toMatchObject({ reason: "dissolved" });
  });
});
