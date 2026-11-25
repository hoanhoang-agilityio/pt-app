import { beforeEach, describe, expect, it, vi } from "vitest";

import { createTestDb, type TestDb } from "@/db/__tests__/create-test-db";
import {
  adminHiddenUsers,
  admins,
  contactAliases,
  exercises,
  users,
  workoutDays,
} from "@/db/schema";

const state = vi.hoisted(() => ({ db: null as unknown }));

vi.mock("server-only", () => ({}));
vi.mock("@/db", () => ({
  db: new Proxy(
    {},
    { get: (_target, property) => Reflect.get(state.db as object, property) },
  ),
}));

const { countMembersInScope, getMemberProgress } =
  await import("@/features/dashboard/services/dashboard-queries");
const { summarizeWeek } = await import("@/features/dashboard/utils/summary");

let db: TestDb;

beforeEach(async () => {
  db = await createTestDb();
  state.db = db;
  await db
    .insert(admins)
    .values({ username: "pt", usernameKey: "pt", passwordHash: "x" });
});

describe("getMemberProgress names and avatars", () => {
  it("carries the nickname and the avatar URL, else real name and none", async () => {
    const [binh, an] = await db
      .insert(users)
      .values([
        {
          name: "Binh",
          nameKey: "binh",
          avatarUpdatedAt: new Date(1_700_000_000_000),
        },
        { name: "An", nameKey: "an" },
      ])
      .returning({ id: users.id });

    await db.insert(contactAliases).values({
      ownerKey: "admin:1",
      targetKey: `user:${binh.id}`,
      alias: "Bé Bình",
      updatedAt: new Date(),
    });

    const members = await getMemberProgress("2026-10-05", 1);

    expect(members.map((m) => [m.id, m.name, m.displayName])).toEqual([
      [an.id, "An", "An"],
      [binh.id, "Binh", "Bé Bình"],
    ]);
    expect(members[0].avatarUrl).toBeNull();
    expect(members[1].avatarUrl).toContain(`/api/avatar/user/${binh.id}`);
  });
});

describe("getMemberProgress PT filter", () => {
  const seed = async () => {
    const [pt] = await db
      .insert(admins)
      .values({
        username: "coach",
        usernameKey: "coach",
        passwordHash: "x",
        role: "pt",
      })
      .returning({ id: admins.id });
    const [mine, loose] = await db
      .insert(users)
      .values([
        { name: "Mine", nameKey: "mine", ptAdminId: pt.id },
        { name: "Loose", nameKey: "loose" },
      ])
      .returning({ id: users.id });

    return { pt: pt.id, mine: mine.id, loose: loose.id };
  };

  it("filters by PT, by none, and shows the PT name on each row", async () => {
    const ids = await seed();

    const all = await getMemberProgress("2026-10-05", 1);
    const byPt = await getMemberProgress("2026-10-05", 1, ids.pt);
    const none = await getMemberProgress("2026-10-05", 1, "none");

    expect(all.map((m) => [m.id, m.ptName])).toEqual([
      [ids.loose, null],
      [ids.mine, "coach"],
    ]);
    expect(byPt.map((m) => m.id)).toEqual([ids.mine]);
    expect(none.map((m) => m.id)).toEqual([ids.loose]);
  });

  it("never widens a PT's own scope", async () => {
    const ids = await seed();

    const asPt = await getMemberProgress("2026-10-05", ids.pt, "none");

    expect(asPt).toEqual([]);
  });
});

describe("countMembersInScope", () => {
  const WEEK = "2026-10-05";

  const plan = async (userId: number, date: string) => {
    const [day] = await db
      .insert(workoutDays)
      .values({ userId, date })
      .returning({ id: workoutDays.id });

    await db
      .insert(exercises)
      .values({ dayId: day.id, title: "Squat", youtubeId: "abc" });
  };

  it("matches summarizeWeek(getMemberProgress) for a super admin and a PT", async () => {
    const [pt] = await db
      .insert(admins)
      .values({
        username: "coach",
        usernameKey: "coach",
        passwordHash: "x",
        role: "pt",
      })
      .returning({ id: admins.id });
    const [planned, twoDays, , hidden, other, lastWeek] = await db
      .insert(users)
      .values([
        { name: "Planned", nameKey: "planned", ptAdminId: pt.id },
        { name: "TwoDays", nameKey: "twodays", ptAdminId: pt.id },
        { name: "Idle", nameKey: "idle", ptAdminId: pt.id },
        { name: "Hidden", nameKey: "hidden", ptAdminId: pt.id },
        { name: "Other", nameKey: "other" },
        { name: "LastWeek", nameKey: "lastweek", ptAdminId: pt.id },
      ])
      .returning({ id: users.id });

    await plan(planned.id, "2026-10-06");
    await plan(twoDays.id, "2026-10-05");
    await plan(twoDays.id, "2026-10-07");
    await plan(hidden.id, "2026-10-06");
    await plan(other.id, "2026-10-06");
    await plan(lastWeek.id, "2026-09-29");
    await db.insert(adminHiddenUsers).values([
      { adminId: 1, userId: hidden.id },
      { adminId: pt.id, userId: hidden.id },
    ]);

    for (const adminId of [1, pt.id]) {
      const summary = summarizeWeek(
        await getMemberProgress(WEEK, adminId, "all"),
      );

      expect(await countMembersInScope(WEEK, adminId)).toEqual({
        memberCount: summary.memberCount,
        plannedCount: summary.plannedCount,
      });
    }
    // Spot-check the fixture so equal-but-wrong (e.g. both 0) cannot pass.
    expect(await countMembersInScope(WEEK, 1)).toEqual({
      memberCount: 5,
      plannedCount: 3,
    });
    expect(await countMembersInScope(WEEK, pt.id)).toEqual({
      memberCount: 4,
      plannedCount: 2,
    });
  });
});
