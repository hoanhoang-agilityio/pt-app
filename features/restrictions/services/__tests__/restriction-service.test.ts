import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createTestDb, type TestDb } from "@/db/__tests__/create-test-db";
import { userRestrictions, users } from "@/db/schema";

const state = vi.hoisted(() => ({ db: null as unknown, isSuper: true }));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/services/logger", () => ({ logServerError: vi.fn() }));
vi.mock("@/db", () => ({
  db: new Proxy(
    {},
    { get: (_target, property) => Reflect.get(state.db as object, property) },
  ),
}));
vi.mock("@/services/auth-guard", () => ({
  requireSuperAdmin: vi.fn(async () => {
    if (!state.isSuper) {
      const { redirect } = await import("next/navigation");

      redirect("/admin");
    }
    return { id: 1, role: "super_admin" };
  }),
}));

const { blockUserAction, liftRestrictionAction } =
  await import("@/features/restrictions/services/restriction-actions");
const queries =
  await import("@/features/restrictions/services/restriction-queries");
const mutations =
  await import("@/features/restrictions/services/restriction-mutations");
const { RESTRICTION_MESSAGES } =
  await import("@/features/restrictions/constants/messages");

let db: TestDb;
let userId: number;

const NOW = new Date("2026-11-14T10:00:00.000Z");
const DAY = 24 * 60 * 60 * 1000;

const addUser = async (name: string) => {
  const [row] = await db
    .insert(users)
    .values({ name, nameKey: name.toLowerCase() })
    .returning({ id: users.id });

  return row.id;
};

const input = (overrides: Record<string, unknown> = {}) => ({
  userId,
  level: "restricted",
  duration: "7d",
  reason: "spam in chat",
  ...overrides,
});

const allRows = () => db.select().from(userRestrictions);

beforeEach(async () => {
  db = await createTestDb();
  state.db = db;
  state.isSuper = true;
  userId = await addUser("An");
});

describe("blocking", () => {
  it("stores the level, end, reason and who blocked", async () => {
    const result = await blockUserAction(input({ duration: "24h" }));

    expect(result.status).toBe("success");
    const [row] = await allRows();

    expect(row).toMatchObject({
      userId,
      level: "restricted",
      reason: "spam in chat",
      createdByAdminId: 1,
      liftedAt: null,
      liftedByAdminId: null,
    });
    expect(row.until!.getTime() - row.createdAt.getTime()).toBe(DAY);
  });

  it("stores no end for a permanent block", async () => {
    await blockUserAction(input({ level: "suspended", duration: "permanent" }));

    const [row] = await allRows();

    expect(row.level).toBe("suspended");
    expect(row.until).toBeNull();
    expect(await queries.findActiveRestriction(userId)).toMatchObject({
      level: "suspended",
      until: null,
      reason: "spam in chat",
    });
  });

  it("blocking again lifts the previous one and keeps it as history", async () => {
    await blockUserAction(input({ reason: "first" }));
    await blockUserAction(
      input({ level: "suspended", duration: "30d", reason: "second" }),
    );

    const rows = (await allRows()).sort((a, b) => a.id - b.id);

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      reason: "first",
      liftedByAdminId: 1,
    });
    expect(rows[0].liftedAt).not.toBeNull();
    expect(rows[1]).toMatchObject({ reason: "second", liftedAt: null });
    expect(await queries.findActiveRestriction(userId)).toMatchObject({
      level: "suspended",
      reason: "second",
    });
  });

  it("refuses a user that does not exist and writes nothing", async () => {
    const result = await blockUserAction(input({ userId: 999 }));

    expect(result).toEqual({
      status: "error",
      message: RESTRICTION_MESSAGES.USER_NOT_FOUND,
    });
    expect(await allRows()).toHaveLength(0);
  });

  it("refuses bad values with a specific message", async () => {
    expect(await blockUserAction(input({ reason: "  " }))).toEqual({
      status: "error",
      message: RESTRICTION_MESSAGES.REASON_REQUIRED,
    });
    expect(await blockUserAction(input({ reason: "a".repeat(301) }))).toEqual({
      status: "error",
      message: RESTRICTION_MESSAGES.REASON_TOO_LONG,
    });
    expect((await blockUserAction(input({ level: "ban" }))).status).toBe(
      "error",
    );
    expect((await blockUserAction(null)).status).toBe("error");
    expect(await allRows()).toHaveLength(0);
  });

  it("refuses a PT: they are redirected and nothing is written", async () => {
    state.isSuper = false;

    const result = await blockUserAction(input()).catch(
      (error: unknown) => error,
    );

    expect(result).toMatchObject({
      digest: expect.stringContaining("REDIRECT"),
    });
    expect(await allRows()).toHaveLength(0);
    expect(await queries.findActiveRestriction(userId)).toBeNull();
  });
});

describe("lifting", () => {
  it("lifts early and records who did it", async () => {
    await blockUserAction(input({ duration: "permanent" }));

    const result = await liftRestrictionAction(userId);

    expect(result.status).toBe("success");
    const [row] = await allRows();

    expect(row.liftedAt).not.toBeNull();
    expect(row.liftedByAdminId).toBe(1);
    expect(await queries.findActiveRestriction(userId)).toBeNull();
  });

  it("answers that nobody is blocked when there is nothing to lift", async () => {
    expect(await liftRestrictionAction(userId)).toEqual({
      status: "error",
      message: RESTRICTION_MESSAGES.NOT_RESTRICTED,
    });
    expect(await liftRestrictionAction("abc")).toEqual({
      status: "error",
      message: RESTRICTION_MESSAGES.INVALID_INPUT,
    });
  });

  it("refuses a PT and leaves the block in place", async () => {
    await blockUserAction(input());
    state.isSuper = false;

    const result = await liftRestrictionAction(userId).catch(
      (error: unknown) => error,
    );

    expect(result).toMatchObject({
      digest: expect.stringContaining("REDIRECT"),
    });
    expect(await queries.findActiveRestriction(userId)).not.toBeNull();
  });
});

describe("expiry at read time", () => {
  it("is active before the end and not after, without any cleanup job", async () => {
    await mutations.applyRestriction(
      1,
      {
        userId,
        level: "restricted",
        duration: "24h",
        reason: "r",
      },
      NOW,
    );

    expect(
      await queries.findActiveRestriction(
        userId,
        new Date(NOW.getTime() + DAY - 1),
      ),
    ).toMatchObject({ level: "restricted" });
    expect(
      await queries.findActiveRestriction(
        userId,
        new Date(NOW.getTime() + DAY),
      ),
    ).toBeNull();
    expect(
      await queries.listSuspendedUserIds(new Date(NOW.getTime() + DAY - 1)),
    ).toEqual([]);
  });

  it("lists active restrictions per user and suspended ids only for suspensions", async () => {
    const other = await addUser("Binh");
    const third = await addUser("Chi");

    await mutations.applyRestriction(
      1,
      { userId, level: "restricted", duration: "7d", reason: "a" },
      NOW,
    );
    await mutations.applyRestriction(
      1,
      { userId: other, level: "suspended", duration: "permanent", reason: "b" },
      NOW,
    );

    const map = await queries.listActiveRestrictions(
      [userId, other, third],
      NOW,
    );

    expect(map.get(userId)?.level).toBe("restricted");
    expect(map.get(other)?.level).toBe("suspended");
    expect(map.has(third)).toBe(false);
    expect(await queries.listSuspendedUserIds(NOW)).toEqual([other]);
  });

  it("does not count an expired row as active when listing", async () => {
    await db.insert(userRestrictions).values({
      userId,
      level: "suspended",
      until: new Date(NOW.getTime() - 1),
      reason: "old",
      createdByAdminId: 1,
      createdAt: new Date(NOW.getTime() - DAY),
    });

    expect((await queries.listActiveRestrictions([userId], NOW)).size).toBe(0);
    expect(await queries.listSuspendedUserIds(NOW)).toEqual([]);
  });
});

describe("member delete cleanup", () => {
  it("removes every restriction row of the trainee and no one else's", async () => {
    const other = await addUser("Binh");

    await mutations.applyRestriction(
      1,
      { userId, level: "restricted", duration: "7d", reason: "a" },
      NOW,
    );
    await mutations.applyRestriction(
      1,
      { userId, level: "suspended", duration: "7d", reason: "b" },
      NOW,
    );
    await mutations.applyRestriction(
      1,
      { userId: other, level: "restricted", duration: "7d", reason: "c" },
      NOW,
    );

    await mutations.deleteRestrictionsOfUser(db, userId);

    expect(
      await db
        .select()
        .from(userRestrictions)
        .where(eq(userRestrictions.userId, userId)),
    ).toHaveLength(0);
    expect(await allRows()).toHaveLength(1);
  });
});
