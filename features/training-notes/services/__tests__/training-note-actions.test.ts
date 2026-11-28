import { asc, eq, sql } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createTestDb, type TestDb } from "@/db/__tests__/create-test-db";
import {
  admins,
  adminTrainingNoteItems,
  adminTrainingNotes,
  adminTrainingNoteSets,
  exerciseLibrary,
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
const { listExerciseNames, listTrainingNotes, toLikePattern } =
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
      sets: Array.from({ length: 4 }, () => ({
        unit: "reps",
        reps: 8,
        durationSec: null,
        weightKg: 80,
        note: null,
      })),
    },
    {
      exerciseName: "Plank",
      sets: Array.from({ length: 3 }, () => ({
        unit: "seconds",
        reps: null,
        durationSec: 45,
        weightKg: null,
        note: null,
      })),
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
      items[0].items.map((i) => [i.position, i.exerciseName, i.sets.length]),
    ).toEqual([
      [0, "Squat", 4],
      [1, "Plank", 3],
    ]);
  });

  it("stores one row per set with exact values and null legacy columns", async () => {
    const result = await saveTrainingNoteAction(
      input({
        items: [
          {
            exerciseName: "Squat",
            sets: [
              {
                unit: "reps",
                reps: 10,
                durationSec: null,
                weightKg: 60,
                note: null,
              },
              {
                unit: "reps",
                reps: 8,
                durationSec: null,
                weightKg: 82.5,
                note: "  Chậm  ",
              },
            ],
          },
          {
            exerciseName: "Plank",
            sets: [
              {
                unit: "seconds",
                reps: null,
                durationSec: 45,
                weightKg: null,
                note: null,
              },
              {
                unit: "reps",
                reps: null,
                durationSec: null,
                weightKg: null,
                note: "",
              },
            ],
          },
          { exerciseName: "Stretch", sets: [] },
        ],
      }),
    );

    expect(result.status).toBe("success");
    const items = await db
      .select()
      .from(adminTrainingNoteItems)
      .orderBy(asc(adminTrainingNoteItems.position));

    expect(
      items.map((i) => [
        i.exerciseName,
        i.sets,
        i.reps,
        i.durationSec,
        i.weightKg,
      ]),
    ).toEqual([
      ["Squat", null, null, null, null],
      ["Plank", null, null, null, null],
      ["Stretch", null, null, null, null],
    ]);
    const rows = await db
      .select()
      .from(adminTrainingNoteSets)
      .orderBy(
        asc(adminTrainingNoteSets.itemId),
        asc(adminTrainingNoteSets.position),
      );

    // The blank spare set of Plank is dropped; Stretch has none.
    expect(
      rows.map((r) => ({
        itemId: r.itemId,
        position: r.position,
        reps: r.reps,
        durationSec: r.durationSec,
        weightKg: r.weightKg,
        note: r.note,
      })),
    ).toEqual([
      {
        itemId: items[0].id,
        position: 0,
        reps: 10,
        durationSec: null,
        weightKg: 60,
        note: null,
      },
      {
        itemId: items[0].id,
        position: 1,
        reps: 8,
        durationSec: null,
        weightKg: 82.5,
        note: "Chậm",
      },
      {
        itemId: items[1].id,
        position: 0,
        reps: null,
        durationSec: 45,
        weightKg: null,
        note: null,
      },
    ]);
    const [listed] = await listTrainingNotes(alice);

    expect(
      listed.items[0].sets.map((s) => [s.unit, s.reps, s.weightKg, s.note]),
    ).toEqual([
      ["reps", 10, 60, null],
      ["reps", 8, 82.5, "Chậm"],
    ]);
    expect(listed.items[1].sets.map((s) => [s.unit, s.durationSec])).toEqual([
      ["seconds", 45],
    ]);
    expect(listed.items[2].sets).toEqual([]);
  });

  it("falls back to the legacy columns for an item without set rows", async () => {
    const [created] = await db
      .insert(adminTrainingNotes)
      .values({ adminId: alice, date: "2026-11-20", title: "Old", note: null })
      .returning({ id: adminTrainingNotes.id });

    await db.insert(adminTrainingNoteItems).values({
      noteId: created.id,
      position: 0,
      exerciseName: "Deadlift",
      sets: 3,
      reps: 5,
      weightKg: 100,
    });
    const [legacy] = await listTrainingNotes(alice);

    expect(
      legacy.items[0].sets.map((s) => [s.position, s.unit, s.reps, s.weightKg]),
    ).toEqual([
      [0, "reps", 5, 100],
      [1, "reps", 5, 100],
      [2, "reps", 5, 100],
    ]);
  });

  it("replaces the items when updating, leaving no orphans without cascade", async () => {
    // Production does not enforce foreign keys (D10), so cascade never fires.
    await db.run(sql`PRAGMA foreign_keys = OFF`);
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
            sets: Array.from({ length: 3 }, () => ({
              unit: "reps",
              reps: 10,
              durationSec: null,
              weightKg: 60,
              note: null,
            })),
          },
        ],
      }),
    );

    expect(result).toEqual({ status: "success", id: created.id });
    const [note] = await listTrainingNotes(alice);

    expect(note.title).toBe("Ngày lưng");
    expect(note.items.map((i) => i.exerciseName)).toEqual(["Row"]);
    const items = await db.select().from(adminTrainingNoteItems);

    expect(items).toHaveLength(1);
    // The old 4 + 3 sets are removed explicitly; only the 3 new ones remain.
    const sets = await db.select().from(adminTrainingNoteSets);

    expect(sets).toHaveLength(3);
    expect(sets.every((row) => row.itemId === items[0].id)).toBe(true);
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
  it("deletes the caller's note and its items and sets without cascade", async () => {
    await db.run(sql`PRAGMA foreign_keys = OFF`);
    const created = await saveTrainingNoteAction(input());

    if (created.status !== "success") {
      throw new Error("create failed");
    }
    const result = await deleteTrainingNoteAction(created.id);

    expect(result.status).toBe("success");
    expect(await db.select().from(adminTrainingNotes)).toHaveLength(0);
    expect(await db.select().from(adminTrainingNoteItems)).toHaveLength(0);
    expect(await db.select().from(adminTrainingNoteSets)).toHaveLength(0);
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
    // The owner check comes first: the other admin's children are untouched.
    expect(await db.select().from(adminTrainingNoteItems)).toHaveLength(2);
    expect(await db.select().from(adminTrainingNoteSets)).toHaveLength(7);
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
            sets: Array.from({ length: 3 }, () => ({
              unit: "reps",
              reps: 5,
              durationSec: null,
              weightKg: 100,
              note: null,
            })),
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

  it("searches title, note and exercise names, ignoring case", async () => {
    await saveTrainingNoteAction(
      input({ title: "Leg Day", note: "heavy", items: [] }),
    );
    await saveTrainingNoteAction(
      input({ title: "B", note: "knee ache", items: [] }),
    );
    await saveTrainingNoteAction(input({ title: "C", note: "" }));
    const titles = async (q: string) =>
      (await listTrainingNotes(alice, { q })).map((n) => n.title).sort();

    expect(await titles("leg")).toEqual(["Leg Day"]);
    expect(await titles("KNEE")).toEqual(["B"]);
    expect(await titles("squat")).toEqual(["C"]);
    expect(await titles("nothing")).toEqual([]);
  });

  it("treats % and _ in the search as plain characters", async () => {
    await saveTrainingNoteAction(input({ title: "50% effort", note: "" }));
    await saveTrainingNoteAction(input({ title: "Easy", note: "" }));

    expect(toLikePattern("50%")).toBe("%50\\%%");
    expect(
      (await listTrainingNotes(alice, { q: "%" })).map((n) => n.title),
    ).toEqual(["50% effort"]);
    expect(await listTrainingNotes(alice, { q: "_" })).toEqual([]);
  });

  it("lists exercise names of the caller only", async () => {
    await saveTrainingNoteAction(input());
    state.adminId = bob;
    await saveTrainingNoteAction(
      input({
        items: [
          {
            exerciseName: "Curl",
            sets: Array.from({ length: 3 }, () => ({
              unit: "reps",
              reps: 10,
              durationSec: null,
              weightKg: 10,
              note: null,
            })),
          },
        ],
      }),
    );

    expect((await listExerciseNames(alice)).sort()).toEqual(["Plank", "Squat"]);
    expect(await listExerciseNames(bob)).toEqual(["Curl"]);
  });
});

describe("exercise_ref", () => {
  const addCustom = async (adminId: number, name: string) => {
    const [row] = await db
      .insert(exerciseLibrary)
      .values({
        adminId,
        name,
        primaryMuscles: '["lats"]',
        secondaryMuscles: '["biceps"]',
      })
      .returning({ id: exerciseLibrary.id });

    return row.id;
  };

  const withRefs = (...refs: (string | null)[]) =>
    input({
      items: refs.map((exerciseRef, index) => ({
        exerciseName: `Bài ${index}`,
        exerciseRef,
        sets: [],
      })),
    });

  const savedRefs = async () =>
    (await listTrainingNotes(alice, { today: "2026-11-25" }))[0].items.map(
      (item) => item.exerciseRef,
    );

  it("saves a built-in ref and returns its muscles", async () => {
    await saveTrainingNoteAction(withRefs("b:3_4_Sit-Up"));

    const [note] = await listTrainingNotes(alice, { today: "2026-11-25" });

    expect(note.items[0]).toMatchObject({
      exerciseRef: "b:3_4_Sit-Up",
      muscles: { primary: ["abdominals"], secondary: [] },
    });
  });

  it("saves the ref of the caller's own custom exercise", async () => {
    const id = await addCustom(alice, "Kéo xà");

    await saveTrainingNoteAction(withRefs(`c:${id}`));

    const [note] = await listTrainingNotes(alice, { today: "2026-11-25" });

    expect(note.items[0]).toMatchObject({
      exerciseName: "Bài 0",
      exerciseRef: `c:${id}`,
      muscles: { primary: ["lats"], secondary: ["biceps"] },
    });
  });

  it("stores no link for free text, a foreign custom ref, a missing one and junk", async () => {
    const bobs = await addCustom(bob, "Của Bob");

    await saveTrainingNoteAction(
      withRefs(null, `c:${bobs}`, "c:9999", "b:does-not-exist", "garbage"),
    );

    expect(await savedRefs()).toEqual([null, null, null, null, null]);
    const rows = await db.select().from(adminTrainingNoteItems);

    expect(rows.map((row) => row.exerciseRef)).toEqual([
      null,
      null,
      null,
      null,
      null,
    ]);
    expect(rows).toHaveLength(5);
  });

  it("keeps the exercise name and reads the ref as no link after the exercise is deleted", async () => {
    const id = await addCustom(alice, "Kéo xà");

    await saveTrainingNoteAction(withRefs(`c:${id}`));
    await db.delete(exerciseLibrary).where(eq(exerciseLibrary.id, id));

    const [note] = await listTrainingNotes(alice, { today: "2026-11-25" });

    expect(note.items[0]).toMatchObject({
      exerciseName: "Bài 0",
      exerciseRef: null,
      muscles: null,
    });
    // The stored value is untouched; only the reader ignores it.
    const [row] = await db.select().from(adminTrainingNoteItems);

    expect(row.exerciseRef).toBe(`c:${id}`);
  });
});
