import { beforeEach, describe, expect, it, vi } from "vitest";

import { createTestDb, type TestDb } from "@/db/__tests__/create-test-db";
import { admins, chatMutes, users } from "@/db/schema";

const state = vi.hoisted(() => ({
  db: null as unknown,
  adminId: 0,
  signedIn: true,
}));

vi.mock("server-only", () => ({}));
vi.mock("@/db", () => ({
  db: new Proxy(
    {},
    { get: (_target, property) => Reflect.get(state.db as object, property) },
  ),
}));
vi.mock("@/services/auth-guard", () => ({
  requireAdmin: vi.fn(async () => {
    if (!state.signedIn) {
      throw new Error("NEXT_REDIRECT");
    }
    return { id: state.adminId };
  }),
}));

const { muteContactAction, unmuteContactAction } =
  await import("@/features/chat/services/chat-mute-actions");

let db: TestDb;
let ptId: number;
let otherPtId: number;
let own: number;
let foreign: number;

const rows = () => db.select().from(chatMutes);

beforeEach(async () => {
  db = await createTestDb();
  state.db = db;
  state.signedIn = true;
  const created = await db
    .insert(admins)
    .values([
      {
        username: "pt-one",
        usernameKey: "pt-one",
        passwordHash: "x",
        role: "pt",
      },
      {
        username: "pt-two",
        usernameKey: "pt-two",
        passwordHash: "x",
        role: "pt",
      },
    ])
    .returning({ id: admins.id });

  ptId = created[0].id;
  otherPtId = created[1].id;
  state.adminId = ptId;
  const members = await db
    .insert(users)
    .values([
      { name: "An", nameKey: "an", ptAdminId: ptId },
      { name: "Binh", nameKey: "binh", ptAdminId: otherPtId },
    ])
    .returning({ id: users.id });

  own = members[0].id;
  foreign = members[1].id;
});

describe("muteContactAction", () => {
  it("stores a timed mute for the admin's own trainee", async () => {
    const before = Date.now();
    const result = await muteContactAction({ userId: own, duration: "4h" });

    expect(result.status).toBe("success");
    const [row] = await rows();

    expect(row.ownerKey).toBe(`admin:${ptId}`);
    expect(row.targetKey).toBe(`user:${own}`);
    expect(row.mutedUntil?.getTime()).toBeGreaterThanOrEqual(
      before + 4 * 3_600_000 - 1000,
    );
  });

  it("stores null for forever and computes tomorrow 08:00 from the offset", async () => {
    await muteContactAction({ userId: own, duration: "forever" });
    expect((await rows())[0].mutedUntil).toBeNull();

    const result = await muteContactAction({
      userId: own,
      duration: "tomorrow8",
      tzOffsetMinutes: -420,
    });
    const [row] = await rows();

    // One row: the second call replaced the first.
    expect(await rows()).toHaveLength(1);
    expect(result).toMatchObject({ status: "success" });
    expect(row.mutedUntil?.getUTCMinutes()).toBe(0);
    expect(row.mutedUntil?.getUTCHours()).toBe(1);
  });

  it("refuses a trainee outside the PT's scope and a missing one, storing nothing", async () => {
    const outOfScope = await muteContactAction({
      userId: foreign,
      duration: "1h",
    });
    const missing = await muteContactAction({ userId: 9999, duration: "1h" });

    expect(outOfScope).toEqual({
      status: "error",
      message: "Không tìm thấy user này",
    });
    expect(missing).toEqual(outOfScope);
    expect(await rows()).toHaveLength(0);
  });

  it("rejects bad input at the boundary", async () => {
    const bad = [
      { userId: own, duration: "2h" },
      { userId: own },
      { userId: -1, duration: "1h" },
      { userId: "5", duration: "1h" },
      { userId: own, duration: "1h", tzOffsetMinutes: 99999 },
      null,
    ];

    for (const input of bad) {
      expect(await muteContactAction(input)).toEqual({
        status: "error",
        message: "Tuỳ chọn tắt thông báo không hợp lệ",
      });
    }
    expect(await rows()).toHaveLength(0);
  });

  it("does nothing without an admin session", async () => {
    state.signedIn = false;

    expect(
      (await muteContactAction({ userId: own, duration: "1h" })).status,
    ).toBe("error");
    expect(await rows()).toHaveLength(0);
  });
});

describe("unmuteContactAction", () => {
  it("removes only the caller's own row and is idempotent", async () => {
    await db.insert(chatMutes).values([
      { ownerKey: `admin:${ptId}`, targetKey: `user:${own}` },
      { ownerKey: `admin:${otherPtId}`, targetKey: `user:${own}` },
    ]);

    expect((await unmuteContactAction({ userId: own })).status).toBe("success");
    expect((await unmuteContactAction({ userId: own })).status).toBe("success");
    expect((await rows()).map((row) => row.ownerKey)).toEqual([
      `admin:${otherPtId}`,
    ]);
  });

  it("rejects a bad user id", async () => {
    expect((await unmuteContactAction({ userId: 0 })).status).toBe("error");
  });
});
