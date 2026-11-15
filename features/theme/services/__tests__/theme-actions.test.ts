import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createTestDb, type TestDb } from "@/db/__tests__/create-test-db";
import { admins, themeLocks, themeSettings, users } from "@/db/schema";

const state = vi.hoisted(() => ({
  db: null as unknown,
  userId: 0,
  adminId: 0,
  // Which guards let the caller through.
  asUser: true,
  asAdmin: true,
  asSuper: true,
  adminSession: false,
}));

vi.mock("server-only", () => ({}));
vi.mock("@/db", () => ({
  db: new Proxy(
    {},
    { get: (_target, property) => Reflect.get(state.db as object, property) },
  ),
}));
vi.mock("next/cache", () => ({
  updateTag: vi.fn(),
  revalidatePath: vi.fn(),
  unstable_cache: (fn: unknown) => fn,
}));
vi.mock("@/services/session", () => ({
  readSession: vi.fn(async () =>
    state.adminSession ? { role: "admin", adminId: state.adminId } : null,
  ),
}));
vi.mock("@/services/auth-guard", async () => {
  const { findAdminById } = await import("@/services/admins");
  const { findUserById } = await import("@/services/users");

  return {
    requireUser: vi.fn(async () => {
      if (!state.asUser) {
        throw new Error("REDIRECT:/session/end");
      }
      return (await findUserById(state.userId))!;
    }),
    requireAdmin: vi.fn(async () => {
      if (!state.asAdmin) {
        throw new Error("REDIRECT:/admin/lock");
      }
      return (await findAdminById(state.adminId))!;
    }),
    requireSuperAdmin: vi.fn(async () => {
      if (!state.asSuper) {
        throw new Error("REDIRECT:/admin");
      }
      return (await findAdminById(state.adminId))!;
    }),
  };
});

const { updateTag } = await import("next/cache");
const actions = await import("@/features/theme/services/theme-actions");

let db: TestDb;

const readUser = async () =>
  (await db.select().from(users).where(eq(users.id, state.userId)))[0];
const readAdmin = async () =>
  (await db.select().from(admins).where(eq(admins.id, state.adminId)))[0];
const readLocks = async () => db.select().from(themeLocks);

const makeAdmin = async (role: "super_admin" | "pt") => {
  const [row] = await db
    .insert(admins)
    .values({
      username: `a-${role}`,
      usernameKey: `a-${role}`,
      passwordHash: "x",
      role,
    })
    .returning();

  state.adminId = row.id;
};

beforeEach(async () => {
  db = await createTestDb();
  state.db = db;
  state.asUser = true;
  state.asAdmin = true;
  state.asSuper = true;
  state.adminSession = false;
  vi.mocked(updateTag).mockClear();
  const [user] = await db
    .insert(users)
    .values({ name: "Lan", nameKey: "lan" })
    .returning();

  state.userId = user.id;
  await makeAdmin("pt");
});

describe("setMyAccentColorAction (trainee)", () => {
  it("saves a normalized color on the trainee only", async () => {
    const result = await actions.setMyAccentColorAction({
      color: "#2563EB",
      audience: "user",
    });

    expect(result).toEqual({ status: "success" });
    expect((await readUser()).accentColor).toBe("#2563eb");
    expect((await readAdmin()).accentColor).toBeNull();
    expect(updateTag).toHaveBeenCalledWith("theme-settings");
  });

  it("resets to the default with null", async () => {
    await db.update(users).set({ accentColor: "#2563eb" });
    await actions.setMyAccentColorAction({ color: null, audience: "user" });

    expect((await readUser()).accentColor).toBeNull();
  });

  it("refuses while trainees are locked and keeps the stored color", async () => {
    await db.update(users).set({ accentColor: "#2563eb" });
    await db.insert(themeLocks).values({ scope: "trainee", locked: true });

    const saved = await actions.setMyAccentColorAction({
      color: "#dc2626",
      audience: "user",
    });
    const reset = await actions.setMyAccentColorAction({
      color: null,
      audience: "user",
    });

    expect(saved).toMatchObject({
      status: "error",
      message: "Quản trị viên đã khoá việc đổi màu chủ đạo",
    });
    expect(reset.status).toBe("error");
    expect((await readUser()).accentColor).toBe("#2563eb");
    expect(updateTag).not.toHaveBeenCalled();
  });

  it("is not affected by the PT lock", async () => {
    await db.insert(themeLocks).values({ scope: "pt", locked: true });
    const result = await actions.setMyAccentColorAction({
      color: "#dc2626",
      audience: "user",
    });

    expect(result.status).toBe("success");
    expect((await readUser()).accentColor).toBe("#dc2626");
  });

  it("works again after unlocking", async () => {
    await db.insert(themeLocks).values({ scope: "trainee", locked: false });
    const result = await actions.setMyAccentColorAction({
      color: "#dc2626",
      audience: "user",
    });

    expect(result.status).toBe("success");
  });

  it("rejects a bad color and writes nothing", async () => {
    for (const color of ["red", "#12", "javascript:1", "#fff;}</style>"]) {
      const result = await actions.setMyAccentColorAction({
        color,
        audience: "user",
      });

      expect(result).toMatchObject({
        status: "error",
        message: "Màu không hợp lệ",
      });
    }
    expect((await readUser()).accentColor).toBeNull();
  });

  it("rejects a bad audience value", async () => {
    const result = await actions.setMyAccentColorAction({
      color: "#2563eb",
      audience: "root" as "user",
    });

    expect(result.status).toBe("error");
    expect((await readUser()).accentColor).toBeNull();
  });

  it("is refused by the user guard before any write", async () => {
    state.asUser = false;

    // The guard throws (a redirect in the app); the wrapper never lets a write happen.
    expect(
      (
        await actions.setMyAccentColorAction({
          color: "#2563eb",
          audience: "user",
        })
      ).status,
    ).toBe("error");
    expect((await readUser()).accentColor).toBeNull();
  });
});

describe("setMyAccentColorAction (PT)", () => {
  it("saves on the PT's own row", async () => {
    const result = await actions.setMyAccentColorAction({
      color: "#15803d",
      audience: "admin",
    });

    expect(result).toEqual({ status: "success" });
    expect((await readAdmin()).accentColor).toBe("#15803d");
    expect((await readUser()).accentColor).toBeNull();
  });

  it("refuses while PTs are locked and keeps the stored color", async () => {
    await db.update(admins).set({ accentColor: "#15803d" });
    await db.insert(themeLocks).values({ scope: "pt", locked: true });

    const result = await actions.setMyAccentColorAction({
      color: "#dc2626",
      audience: "admin",
    });

    expect(result).toMatchObject({
      status: "error",
      message: "Quản trị viên đã khoá việc đổi màu chủ đạo",
    });
    expect((await readAdmin()).accentColor).toBe("#15803d");
  });

  it("is not affected by the trainee lock", async () => {
    await db.insert(themeLocks).values({ scope: "trainee", locked: true });
    const result = await actions.setMyAccentColorAction({
      color: "#dc2626",
      audience: "admin",
    });

    expect(result.status).toBe("success");
  });

  it("uses the admin guard, refused when the admin is locked out", async () => {
    state.asAdmin = false;

    // The guard throws (a redirect in the app); the wrapper never lets a write happen.
    expect(
      (
        await actions.setMyAccentColorAction({
          color: "#dc2626",
          audience: "admin",
        })
      ).status,
    ).toBe("error");
    expect((await readAdmin()).accentColor).toBeNull();
  });

  it("picks the admin when no audience is given and an admin session exists", async () => {
    state.adminSession = true;
    await actions.setMyAccentColorAction({ color: "#dc2626" });

    expect((await readAdmin()).accentColor).toBe("#dc2626");
    expect((await readUser()).accentColor).toBeNull();
  });

  it("picks the trainee when no audience is given and no admin session", async () => {
    await actions.setMyAccentColorAction({ color: "#dc2626" });

    expect((await readUser()).accentColor).toBe("#dc2626");
    expect((await readAdmin()).accentColor).toBeNull();
  });
});

describe("setMyAccentColorAction (super admin)", () => {
  beforeEach(async () => {
    await makeAdmin("super_admin");
  });

  it("is never locked, even with both locks on", async () => {
    await db.insert(themeLocks).values([
      { scope: "pt", locked: true },
      { scope: "trainee", locked: true },
    ]);
    const result = await actions.setMyAccentColorAction({
      color: "#7c3aed",
      audience: "admin",
    });

    expect(result).toEqual({ status: "success" });
    expect((await readAdmin()).accentColor).toBe("#7c3aed");
  });
});

describe("setThemeLockAction", () => {
  beforeEach(async () => {
    await makeAdmin("super_admin");
  });

  it("locks a role and records who and when", async () => {
    const result = await actions.setThemeLockAction({
      scope: "pt",
      locked: true,
    });
    const rows = await readLocks();

    expect(result).toEqual({ status: "success" });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      scope: "pt",
      locked: true,
      updatedByAdminId: state.adminId,
    });
    expect(updateTag).toHaveBeenCalledWith("theme-settings");
  });

  it("unlocks by updating the same row, other role untouched", async () => {
    await actions.setThemeLockAction({ scope: "pt", locked: true });
    await actions.setThemeLockAction({ scope: "trainee", locked: true });
    await actions.setThemeLockAction({ scope: "pt", locked: false });
    const rows = await readLocks();

    expect(rows).toHaveLength(2);
    expect(rows.find((row) => row.scope === "pt")?.locked).toBe(false);
    expect(rows.find((row) => row.scope === "trainee")?.locked).toBe(true);
  });

  it("keeps personal colors when locking and unlocking", async () => {
    await db.update(users).set({ accentColor: "#2563eb" });
    await actions.setThemeLockAction({ scope: "trainee", locked: true });
    await actions.setThemeLockAction({ scope: "trainee", locked: false });

    expect((await db.select().from(users))[0].accentColor).toBe("#2563eb");
  });

  it("rejects an unknown scope and a non-boolean, writing nothing", async () => {
    const badScope = await actions.setThemeLockAction({
      scope: "all",
      locked: true,
    });
    const badValue = await actions.setThemeLockAction({
      scope: "pt",
      locked: "yes" as unknown as boolean,
    });

    expect(badScope).toMatchObject({
      status: "error",
      message: "Phạm vi không hợp lệ",
    });
    expect(badValue.status).toBe("error");
    expect(await readLocks()).toEqual([]);
  });

  it("is refused for a non-super admin before any write", async () => {
    state.asSuper = false;

    // The guard throws (a redirect in the app); the wrapper never lets a write happen.
    expect(
      (await actions.setThemeLockAction({ scope: "pt", locked: true })).status,
    ).toBe("error");
    expect(await readLocks()).toEqual([]);
  });
});

describe("setAccentColorAction guard", () => {
  it("is refused for a non-super admin before any write", async () => {
    state.asSuper = false;

    // The guard throws (a redirect in the app); the wrapper never lets a write happen.
    expect(
      (await actions.setAccentColorAction({ scope: "all", color: "#2563eb" }))
        .status,
    ).toBe("error");
    expect(await db.select().from(themeSettings)).toEqual([]);
  });
});
