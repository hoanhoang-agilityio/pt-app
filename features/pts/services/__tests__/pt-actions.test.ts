import { eq, sql } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { INITIAL_FORM_STATE } from "@/constants/form";
import { createTestDb, type TestDb } from "@/db/__tests__/create-test-db";
import {
  admins,
  chatGroupMembers,
  chatGroupMessages,
  chatGroups,
  users,
} from "@/db/schema";
import { logServerError } from "@/services/logger";

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

const { createPtAction, setAdminVerifiedAction, assignTraineePtAction } =
  await import("@/features/pts/services/pt-actions");
const { verifyPassword } = await import("@/services/password");

let db: TestDb;

const toFormData = (fields: Record<string, string>) => {
  const formData = new FormData();

  for (const [key, value] of Object.entries(fields)) {
    formData.set(key, value);
  }
  return formData;
};

const addPt = async (name: string) => {
  const [row] = await db
    .insert(admins)
    .values({
      username: name,
      usernameKey: name,
      passwordHash: "x",
      role: "pt",
    })
    .returning({ id: admins.id });

  return row.id;
};

beforeEach(async () => {
  db = await createTestDb();
  state.db = db;
  state.isSuper = true;
});

describe("createPtAction", () => {
  it("creates a PT with a hashed password and no tick", async () => {
    const result = await createPtAction(
      INITIAL_FORM_STATE,
      toFormData({ username: "Coach.An", password: "long-enough-1" }),
    );

    expect(result.status).toBe("success");
    const [row] = await db.select().from(admins);

    expect(row).toMatchObject({
      username: "Coach.An",
      usernameKey: "coach.an",
      role: "pt",
      verifiedAt: null,
    });
    expect(row.passwordHash).not.toContain("long-enough-1");
    expect(await verifyPassword("long-enough-1", row.passwordHash)).toBe(true);
  });

  it("rejects a bad username and a short password with field errors", async () => {
    const result = await createPtAction(
      INITIAL_FORM_STATE,
      toFormData({ username: "a b", password: "short" }),
    );

    expect(result.status).toBe("error");
    expect(result.fieldErrors?.username).toBeTruthy();
    expect(result.fieldErrors?.password).toBeTruthy();
    expect(await db.select().from(admins)).toHaveLength(0);
  });

  it("rejects a duplicate username, case-insensitively", async () => {
    await addPt("coach");
    const result = await createPtAction(
      INITIAL_FORM_STATE,
      toFormData({ username: "COACH", password: "long-enough-1" }),
    );

    expect(result.status).toBe("error");
    expect(result.fieldErrors?.username).toBeTruthy();
    expect(await db.select().from(admins)).toHaveLength(1);
  });

  it("refuses a PT caller and writes nothing", async () => {
    state.isSuper = false;
    const result = await createPtAction(
      INITIAL_FORM_STATE,
      toFormData({ username: "coach", password: "long-enough-1" }),
    ).catch((error: unknown) => error);

    expect(result).toMatchObject({
      digest: expect.stringContaining("REDIRECT"),
    });
    expect(await db.select().from(admins)).toHaveLength(0);
  });
});

describe("setAdminVerifiedAction", () => {
  it("grants and removes the tick", async () => {
    const id = await addPt("coach");

    expect(await setAdminVerifiedAction(id, true)).toEqual({
      status: "success",
    });
    expect((await db.select().from(admins))[0].verifiedAt).toBeInstanceOf(Date);
    await setAdminVerifiedAction(id, false);
    expect((await db.select().from(admins))[0].verifiedAt).toBeNull();
  });

  it("reports an unknown admin", async () => {
    expect((await setAdminVerifiedAction(99, true)).status).toBe("error");
  });
});

describe("assignTraineePtAction", () => {
  let counter = 0;
  const addUser = async () => {
    counter += 1;

    return (
      await db
        .insert(users)
        .values({ name: `Lan${counter}`, nameKey: `lan${counter}` })
        .returning({ id: users.id })
    )[0].id;
  };

  it("assigns and clears the PT of a trainee", async () => {
    const pt = await addPt("coach");
    const user = await addUser();

    expect((await assignTraineePtAction(user, pt)).status).toBe("success");
    const [assigned] = await db.select().from(users).where(eq(users.id, user));

    expect(assigned.ptAdminId).toBe(pt);
    await assignTraineePtAction(user, null);
    const [cleared] = await db.select().from(users).where(eq(users.id, user));

    expect(cleared.ptAdminId).toBeNull();
  });

  it("refuses a target that is not a PT account", async () => {
    const [boss] = await db
      .insert(admins)
      .values({
        username: "boss",
        usernameKey: "boss",
        passwordHash: "x",
        role: "super_admin",
      })
      .returning({ id: admins.id });
    const user = await addUser();

    expect((await assignTraineePtAction(user, boss.id)).status).toBe("error");
    expect((await db.select().from(users))[0].ptAdminId).toBeNull();
  });

  it("reports an unknown trainee", async () => {
    const pt = await addPt("coach");

    expect((await assignTraineePtAction(999, pt)).status).toBe("error");
  });
  describe("group chat alerts", () => {
    const addGroupWith = async (userId: number) => {
      const [group] = await db
        .insert(chatGroups)
        .values({ name: "Lớp", createdByKey: "admin:1", createdAt: new Date() })
        .returning({ id: chatGroups.id });

      await db.insert(chatGroupMembers).values({
        groupId: group.id,
        memberKey: `user:${userId}`,
        addedByKey: "admin:1",
        joinedAt: new Date(),
      });
      return group.id;
    };
    const alerts = async () =>
      (await db.select().from(chatGroupMessages)).filter(
        (row) => row.audience === "super_admin",
      );

    it("writes one super-admin-only alert in the trainee's group when the PT changes", async () => {
      const oldPt = await addPt("old");
      const newPt = await addPt("new");
      const user = await addUser();
      const groupId = await addGroupWith(user);

      await assignTraineePtAction(user, oldPt);
      expect(await alerts()).toHaveLength(1);
      await assignTraineePtAction(user, newPt);
      const rows = await alerts();

      expect(rows).toHaveLength(2);
      expect(rows.every((row) => row.groupId === groupId)).toBe(true);
      expect(JSON.parse(rows[1].systemEvent!)).toMatchObject({
        type: "pt_changed",
        userId: user,
        fromPtId: oldPt,
        toPtId: newPt,
        resolution: null,
      });
    });

    it("does nothing when the same PT is saved again", async () => {
      const pt = await addPt("coach");
      const user = await addUser();

      await addGroupWith(user);
      await assignTraineePtAction(user, pt);
      expect(await alerts()).toHaveLength(1);

      expect(await assignTraineePtAction(user, pt)).toEqual({
        status: "success",
      });
      expect(await alerts()).toHaveLength(1);
      // Clearing a PT that is already clear is a no-op too.
      const other = await addUser();

      await addGroupWith(other);
      expect(await assignTraineePtAction(other, null)).toEqual({
        status: "success",
      });
      expect(
        (await alerts()).filter(
          (row) => JSON.parse(row.systemEvent!).userId === other,
        ),
      ).toHaveLength(0);
    });

    it("writes no alert for a trainee who is in no group", async () => {
      const pt = await addPt("coach");
      const user = await addUser();

      await assignTraineePtAction(user, pt);
      expect(await alerts()).toHaveLength(0);
    });

    it("keeps the assignment when the alert cannot be written, and logs it", async () => {
      const pt = await addPt("coach");
      const user = await addUser();

      await db.run(sql`drop table chat_group_members`);
      const result = await assignTraineePtAction(user, pt);

      expect(result).toEqual({ status: "success" });
      expect(
        (await db.select().from(users).where(eq(users.id, user)))[0].ptAdminId,
      ).toBe(pt);
      expect(logServerError).toHaveBeenCalledWith(
        "recordPtChangeInGroups",
        expect.any(Error),
        { userId: user },
      );
    });
  });
});
