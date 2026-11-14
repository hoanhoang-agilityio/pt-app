import { beforeEach, describe, expect, it, vi } from "vitest";

import { createTestDb, type TestDb } from "@/db/__tests__/create-test-db";
import { adminHiddenUsers, contactAliases } from "@/db/schema";
import {
  seedAdmin,
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

const { listGroupCandidates } =
  await import("@/features/chat-groups/services/group-candidates");

let db: TestDb;
let superId: number;
let ptId: number;
let otherPtId: number;
let anId: number;
let binhId: number;
let chiId: number;

beforeEach(async () => {
  db = await createTestDb();
  state.db = db;
  superId = await seedAdmin(db, "Boss", "super_admin");
  ptId = await seedAdmin(db, "Coach", "pt");
  otherPtId = await seedAdmin(db, "Other", "pt");
  anId = await seedUser(db, "An", { ptAdminId: ptId });
  binhId = await seedUser(db, "Binh", { ptAdminId: ptId });
  chiId = await seedUser(db, "Chi", { ptAdminId: otherPtId });
});

const names = (rows: { name: string }[]) => rows.map((row) => row.name);

describe("listGroupCandidates", () => {
  it("offers a PT only their own trainees and never another PT", async () => {
    const result = await listGroupCandidates({
      kind: "admin",
      id: ptId,
      role: "pt",
    });

    expect(names(result.trainees)).toEqual(["An", "Binh"]);
    expect(result.trainees.map((row) => row.key)).toEqual([
      `user:${anId}`,
      `user:${binhId}`,
    ]);
    expect(result.pts).toEqual([]);
  });

  it("drops the trainees this PT hid", async () => {
    await db.insert(adminHiddenUsers).values({ adminId: ptId, userId: anId });
    const result = await listGroupCandidates({
      kind: "admin",
      id: ptId,
      role: "pt",
    });

    expect(names(result.trainees)).toEqual(["Binh"]);
  });

  it("offers a super admin every trainee and every PT, but no super admin", async () => {
    const result = await listGroupCandidates({
      kind: "admin",
      id: superId,
      role: "super_admin",
    });

    expect(names(result.trainees)).toEqual(["An", "Binh", "Chi"]);
    expect(names(result.pts)).toEqual(["Coach", "Other"]);
    expect(result.pts.map((row) => row.kind)).toEqual(["admin", "admin"]);
  });

  it("leaves out people who are already in and shows the viewer's nickname", async () => {
    await db.insert(contactAliases).values({
      ownerKey: `admin:${ptId}`,
      targetKey: `user:${binhId}`,
      alias: "Bình béo",
      updatedAt: new Date(),
    });
    const result = await listGroupCandidates(
      { kind: "admin", id: ptId, role: "pt" },
      new Set([`user:${anId}`]),
    );

    expect(names(result.trainees)).toEqual(["Bình béo"]);
  });
});
