import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createTestDb, type TestDb } from "@/db/__tests__/create-test-db";
import {
  admins,
  adminTrainingNoteItems,
  adminTrainingNotes,
} from "@/db/schema";
import { TRAINING_NOTE_MESSAGES as MESSAGES } from "@/features/training-notes/constants/messages";
import type { TrainingNoteInput } from "@/features/training-notes/utils/note-schema";

const state = vi.hoisted(() => ({ db: null as unknown, adminId: 1 }));

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
  requireAdmin: vi.fn(async () => ({ id: state.adminId, role: "pt" })),
}));

const { deleteTrainingNoteAction, saveTrainingNoteAction } =
  await import("@/features/training-notes/services/training-note-actions");
const { listExerciseNames, listTrainingNotes } =
  await import("@/features/training-notes/services/training-note-queries");

let db: TestDb;
let alice: number;
let bob: number;

const input = (
  overrides: Partial<TrainingNoteInput> = {},
): TrainingNoteInput => ({
  date: "2026-11-25",
  title: "Ngày chân",
  note: "Felt strong",
  items: [
    {
      exerciseName: "Squat",
      sets: 4,
      reps: 8,
      durationSec: null,
      weightKg: 80,
    },
    {
      exerciseName: "Plank",
      sets: 3,
      reps: null,
      durationSec: 45,
      weightKg: null,
    },
  ],
  ...overrides,
});

const addAdmin = async (name: string) => {
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
  alice = await addAdmin("alice");
  bob = await addAdmin("bob");
  state.adminId = alice;
});

describe("saveTrainingNoteAction", () => {
  it("creates a note for the caller with ordered items", async () => {
    const result = await saveTrainingNoteAction(input());

    expect(result.status).toBe("success");
    const [saved] = await db.select().from(adminTrainingNotes);

    expect(saved).toMatchObject({
      adminId: alice,
      date: "2026-11-25",
      title: "Ngày chân",
      note: "Felt strong",
    });
    const items = await listTrainingNotes(alice, { today: "2026-11-25" });

    expect(
      items[0].items.map((i) => [i.position, i.exerciseName, i.durationSec]),
    ).toEqual([
      [0, "Squat", null],
      [1, "Plank", 45],
    ]);
  });

  it("replaces the items when updating", async () => {
    const created = await saveTrainingNoteAction(input());

    if (created.status !== "success") {
      throw new Error("create failed");
    }
    const result = await saveTrainingNoteAction(
      input({
        id: created.id,
        title: "Ngày lưng",
        items: [
          {
            exerciseName: "Row",
            sets: 3,
            reps: 10,
            durationSec: null,
            weightKg: 60,
          },
        ],
      }),
    );

    expect(result).toEqual({ status: "success", id: created.id });
    const [note] = await listTrainingNotes(alice);

    expect(note.title).toBe("Ngày lưng");
    expect(note.items.map((i) => i.exerciseName)).toEqual(["Row"]);
    expect(await db.select().from(adminTrainingNoteItems)).toHaveLength(1);
  });

  it("does not touch another admin's note", async () => {
    state.adminId = bob;
    const created = await saveTrainingNoteAction(input());

    if (created.status !== "success") {
      throw new Error("create failed");
    }
    state.adminId = alice;
    const result = await saveTrainingNoteAction(
      input({ id: created.id, title: "Hijacked", items: [] }),
    );

    expect(result).toEqual({ status: "error", message: MESSAGES.NOT_FOUND });
    const [row] = await db
      .select()
      .from(adminTrainingNotes)
      .where(eq(adminTrainingNotes.id, created.id));

    expect(row).toMatchObject({ adminId: bob, title: "Ngày chân" });
    expect(await db.select().from(adminTrainingNoteItems)).toHaveLength(2);
  });

  it("returns not found for an id that does not exist", async () => {
    const result = await saveTrainingNoteAction(input({ id: 999 }));

    expect(result).toEqual({ status: "error", message: MESSAGES.NOT_FOUND });
    expect(await db.select().from(adminTrainingNotes)).toHaveLength(0);
  });

  it("returns the validation message and writes nothing", async () => {
    const result = await saveTrainingNoteAction(input({ note: "", items: [] }));

    expect(result).toEqual({ status: "error", message: MESSAGES.EMPTY });
    expect(await db.select().from(adminTrainingNotes)).toHaveLength(0);
  });
});

describe("deleteTrainingNoteAction", () => {
  it("deletes the caller's note and its items", async () => {
    const created = await saveTrainingNoteAction(input());

    if (created.status !== "success") {
      throw new Error("create failed");
    }
    const result = await deleteTrainingNoteAction(created.id);

    expect(result.status).toBe("success");
    expect(await db.select().from(adminTrainingNotes)).toHaveLength(0);
    expect(await db.select().from(adminTrainingNoteItems)).toHaveLength(0);
  });

  it("does not delete another admin's note", async () => {
    state.adminId = bob;
    const created = await saveTrainingNoteAction(input());

    if (created.status !== "success") {
      throw new Error("create failed");
    }
    state.adminId = alice;
    const result = await deleteTrainingNoteAction(created.id);

    expect(result).toEqual({ status: "error", message: MESSAGES.NOT_FOUND });
    expect(await db.select().from(adminTrainingNotes)).toHaveLength(1);
  });

  it("returns not found for a bad id", async () => {
    expect(await deleteTrainingNoteAction(-1)).toEqual({
      status: "error",
      message: MESSAGES.NOT_FOUND,
    });
  });
});

describe("listTrainingNotes", () => {
  it("lists only the caller's notes, newest day first", async () => {
    await saveTrainingNoteAction(input({ date: "2026-11-20" }));
    await saveTrainingNoteAction(input({ date: "2026-11-25" }));
    state.adminId = bob;
    await saveTrainingNoteAction(input({ date: "2026-11-30" }));

    expect((await listTrainingNotes(alice)).map((n) => n.date)).toEqual([
      "2026-11-25",
      "2026-11-20",
    ]);
    expect((await listTrainingNotes(bob)).map((n) => n.date)).toEqual([
      "2026-11-30",
    ]);
  });

  it("filters by range and by search text", async () => {
    await saveTrainingNoteAction(input({ date: "2026-10-30", title: "Old" }));
    await saveTrainingNoteAction(input({ date: "2026-11-02", title: "Early" }));
    await saveTrainingNoteAction(
      input({
        date: "2026-11-24",
        title: "Back",
        note: "",
        items: [
          {
            exerciseName: "Deadlift",
            sets: 3,
            reps: 5,
            durationSec: null,
            weightKg: 100,
          },
        ],
      }),
    );
    const today = "2026-11-25";

    expect(
      (await listTrainingNotes(alice, { range: "week", today })).map(
        (n) => n.title,
      ),
    ).toEqual(["Back"]);
    expect(
      (await listTrainingNotes(alice, { range: "month", today })).map(
        (n) => n.title,
      ),
    ).toEqual(["Back", "Early"]);
    expect(
      (await listTrainingNotes(alice, { q: "deadlift", today })).map(
        (n) => n.title,
      ),
    ).toEqual(["Back"]);
  });

  it("lists exercise names of the caller only", async () => {
    await saveTrainingNoteAction(input());
    state.adminId = bob;
    await saveTrainingNoteAction(
      input({
        items: [
          {
            exerciseName: "Curl",
            sets: 3,
            reps: 10,
            durationSec: null,
            weightKg: 10,
          },
        ],
      }),
    );

    expect((await listExerciseNames(alice)).sort()).toEqual(["Plank", "Squat"]);
    expect(await listExerciseNames(bob)).toEqual(["Curl"]);
  });
});
