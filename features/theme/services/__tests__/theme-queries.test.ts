import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createTestDb, type TestDb } from "@/db/__tests__/create-test-db";
import { admins, themeLocks, themeSettings, users } from "@/db/schema";

const state = vi.hoisted(() => ({
  db: null as unknown,
  adminSession: null as null | { adminId: number },
  userSession: null as null | { userId: number },
}));

vi.mock("server-only", () => ({}));
vi.mock("@/db", () => ({
  db: new Proxy(
    {},
    { get: (_target, property) => Reflect.get(state.db as object, property) },
  ),
}));
vi.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn }));
vi.mock("@/services/session", () => ({
  readSession: vi.fn(async (cookie: string) =>
    cookie.includes("admin") && state.adminSession
      ? { role: "admin", ...state.adminSession }
      : !cookie.includes("admin") && state.userSession
        ? { role: "user", ...state.userSession }
        : null,
  ),
}));

const queries = await import("@/features/theme/services/theme-queries");

let db: TestDb;
let userId = 0;
let ptId = 0;
let superId = 0;

const lock = (scope: "trainee" | "pt", locked: boolean) =>
  db.insert(themeLocks).values({ scope, locked });

beforeEach(async () => {
  db = await createTestDb();
  state.db = db;
  state.adminSession = null;
  state.userSession = null;
  const [user] = await db
    .insert(users)
    .values({ name: "Lan", nameKey: "lan", accentColor: "#111111" })
    .returning();
  const [pt] = await db
    .insert(admins)
    .values({
      username: "pt",
      usernameKey: "pt",
      passwordHash: "x",
      role: "pt",
      accentColor: "#222222",
    })
    .returning();
  const [boss] = await db
    .insert(admins)
    .values({
      username: "boss",
      usernameKey: "boss",
      passwordHash: "x",
      role: "super_admin",
      accentColor: "#333333",
    })
    .returning();

  userId = user.id;
  ptId = pt.id;
  superId = boss.id;
  await db.insert(themeSettings).values([
    { scope: "all", accent: "#aaaaaa" },
    { scope: "trainee", accent: "#bbbbbb" },
    { scope: "pt", accent: "#cccccc" },
  ]);
});

describe("getViewerAccent", () => {
  it("trainee: personal wins while unlocked", async () => {
    state.userSession = { userId };

    expect(await queries.getViewerAccent()).toBe("#111111");
  });

  it("trainee: locked ignores personal and uses the trainee color", async () => {
    state.userSession = { userId };
    await lock("trainee", true);

    expect(await queries.getViewerAccent()).toBe("#bbbbbb");
  });

  it("trainee: locked without a trainee color falls to all", async () => {
    state.userSession = { userId };
    await lock("trainee", true);
    await db.delete(themeSettings).where(eq(themeSettings.scope, "trainee"));

    expect(await queries.getViewerAccent()).toBe("#aaaaaa");
  });

  it("trainee: the PT lock changes nothing", async () => {
    state.userSession = { userId };
    await lock("pt", true);

    expect(await queries.getViewerAccent()).toBe("#111111");
  });

  it("PT: personal wins unlocked, role color when locked", async () => {
    state.adminSession = { adminId: ptId };

    expect(await queries.getViewerAccent()).toBe("#222222");
    await lock("pt", true);
    expect(await queries.getViewerAccent()).toBe("#cccccc");
  });

  it("PT: the personal color comes back after unlocking", async () => {
    state.adminSession = { adminId: ptId };
    await lock("pt", true);
    await db.update(themeLocks).set({ locked: false });

    expect(await queries.getViewerAccent()).toBe("#222222");
  });

  it("super admin: self > all, never locked", async () => {
    state.adminSession = { adminId: superId };
    await lock("pt", true);
    await lock("trainee", true);

    expect(await queries.getViewerAccent()).toBe("#333333");
    await db.update(admins).set({ accentColor: null });
    // No role layer for the super admin: straight to "all".
    expect(await queries.getViewerAccent()).toBe("#aaaaaa");
  });

  it("anonymous: the all color", async () => {
    expect(await queries.getViewerAccent()).toBe("#aaaaaa");
  });

  it("a stored invalid personal color is ignored", async () => {
    state.userSession = { userId };
    await db.update(users).set({ accentColor: "javascript:1" });

    expect(await queries.getViewerAccent()).toBe("#bbbbbb");
  });
});

describe("getPersonalTheme and canPickPersonalColor", () => {
  it("reports the saved color and the lock per role", async () => {
    await lock("trainee", true);

    expect(
      await queries.getPersonalTheme({ kind: "user", id: userId }),
    ).toEqual({ saved: "#111111", locked: true });
    expect(await queries.getPersonalTheme({ kind: "admin", id: ptId })).toEqual(
      { saved: "#222222", locked: false },
    );
  });

  it("never reports the super admin as locked", async () => {
    await lock("pt", true);

    expect(
      await queries.getPersonalTheme({ kind: "admin", id: superId }),
    ).toEqual({ saved: "#333333", locked: false });
  });

  it("hides the menu entry for a locked role only", async () => {
    await lock("pt", true);

    expect(await queries.canPickPersonalColor("pt")).toBe(false);
    expect(await queries.canPickPersonalColor("user")).toBe(true);
    expect(await queries.canPickPersonalColor("super")).toBe(true);
  });

  it("returns a missing viewer as no color and unlocked", async () => {
    expect(await queries.getPersonalTheme({ kind: "user", id: 9999 })).toEqual({
      saved: null,
      locked: false,
    });
  });
});
