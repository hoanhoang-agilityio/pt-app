import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createTestDb, type TestDb } from "@/db/__tests__/create-test-db";
import { admins, exerciseLibrary } from "@/db/schema";
import { EXERCISE_MESSAGES as MESSAGES } from "@/features/exercise-library/constants/messages";

const state = vi.hoisted(() => ({
  db: null as unknown,
  adminId: 1,
  isAdmin: true,
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/services/logger", () => ({
  logServerError: vi.fn(() => ({ code: "UNKNOWN", detail: "test" })),
}));
vi.mock("@/db", () => ({
  db: new Proxy(
    {},
    { get: (_target, property) => Reflect.get(state.db as object, property) },
  ),
}));
vi.mock("@/services/auth-guard", () => ({
  requireAdmin: vi.fn(async () => {
    if (!state.isAdmin) {
      throw new Error("NEXT_REDIRECT");
    }
    return { id: state.adminId, role: "pt" };
  }),
}));

const {
  createExercise,
  deleteExercise,
  getExercise,
  searchExercises,
  updateExercise,
} = await import("@/features/exercise-library/services/exercise-actions");

// A 1x1 lossless WebP, the smallest valid photo.
const WEBP_1X1 =
  "data:image/webp;base64,UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==";

let db: TestDb;
let alice: number;
let bob: number;

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

const create = async (name: string, extra = {}) => {
  const result = await createExercise({
    name,
    primary: ["lats"],
    secondary: ["biceps"],
    ...extra,
  });

  if (result.status !== "success" || !("ref" in result)) {
    throw new Error("create failed");
  }
  return Number(result.ref.slice(2));
};

beforeEach(async () => {
  db = await createTestDb();
  state.db = db;
  state.isAdmin = true;
  alice = await addAdmin("alice");
  bob = await addAdmin("bob");
  state.adminId = alice;
});

describe("every action requires an admin", () => {
  it("rejects a caller without an admin session before touching data", async () => {
    state.isAdmin = false;

    expect((await createExercise({ name: "A" })).status).toBe("error");
    expect((await searchExercises({ q: "" })).status).toBe("error");
    expect((await getExercise("b:Squat")).status).toBe("error");
    expect((await updateExercise(1, { name: "A" })).status).toBe("error");
    expect((await deleteExercise(1)).status).toBe("error");
    expect(await db.select().from(exerciseLibrary)).toEqual([]);
  });
});

describe("createExercise", () => {
  it("stores a custom exercise for the caller with its muscles", async () => {
    const id = await create("  Kéo xà rộng  ", { equipment: "Xà đơn" });
    const [row] = await db.select().from(exerciseLibrary);

    expect(row).toMatchObject({
      id,
      adminId: alice,
      name: "Kéo xà rộng",
      primaryMuscles: '["lats"]',
      secondaryMuscles: '["biceps"]',
      equipment: "Xà đơn",
      instructions: null,
      photoData: null,
    });
  });

  it("rejects a bad name and an unknown muscle with the specific message", async () => {
    expect(await createExercise({ name: " " })).toMatchObject({
      status: "error",
      message: MESSAGES.NAME_REQUIRED,
    });
    expect(
      await createExercise({
        name: "A",
        primary: ["wings"] as unknown as ["lats"],
      }),
    ).toMatchObject({ status: "error", message: MESSAGES.MUSCLE_INVALID });
    expect(await db.select().from(exerciseLibrary)).toEqual([]);
  });

  it("stores a valid photo with its type and size read from the bytes", async () => {
    const id = await create("Có ảnh", { photo: WEBP_1X1 });
    const [row] = await db
      .select()
      .from(exerciseLibrary)
      .where(eq(exerciseLibrary.id, id));

    expect(row).toMatchObject({
      photoMime: "image/webp",
      photoWidth: 1,
      photoHeight: 1,
    });
    expect(row.photoSize).toBe(row.photoData?.length);
  });

  it("refuses a photo whose bytes are not the declared image", async () => {
    const fake = `data:image/webp;base64,${Buffer.from("hello world").toString("base64")}`;

    expect(await createExercise({ name: "A", photo: fake })).toMatchObject({
      status: "error",
      message: MESSAGES.PHOTO_INVALID,
    });
    expect(await db.select().from(exerciseLibrary)).toEqual([]);
  });
});

describe("updateExercise", () => {
  it("updates the caller's exercise and keeps the photo when it is not sent", async () => {
    const id = await create("Cũ", { photo: WEBP_1X1 });

    const result = await updateExercise(id, {
      name: "Mới",
      primary: ["chest"],
    });

    expect(result.status).toBe("success");
    const [row] = await db.select().from(exerciseLibrary);

    expect(row).toMatchObject({
      name: "Mới",
      primaryMuscles: '["chest"]',
      secondaryMuscles: "[]",
      photoMime: "image/webp",
    });
  });

  it("removes the photo when it is null", async () => {
    const id = await create("A", { photo: WEBP_1X1 });

    await updateExercise(id, { name: "A", photo: null });
    const [row] = await db.select().from(exerciseLibrary);

    expect(row).toMatchObject({
      photoMime: null,
      photoData: null,
      photoSize: null,
    });
  });

  it("answers not found for another admin's exercise and leaves it unchanged", async () => {
    const id = await create("Của Alice");

    state.adminId = bob;
    expect(await updateExercise(id, { name: "Của Bob" })).toMatchObject({
      status: "error",
      message: MESSAGES.NOT_FOUND,
    });
    const [row] = await db.select().from(exerciseLibrary);

    expect(row.name).toBe("Của Alice");
  });

  it("answers not found for a missing or invalid id", async () => {
    for (const id of [999, 0, -1, 1.5]) {
      expect(await updateExercise(id, { name: "A" })).toMatchObject({
        status: "error",
        message: MESSAGES.NOT_FOUND,
      });
    }
  });
});

describe("deleteExercise", () => {
  it("deletes only the caller's exercise", async () => {
    const id = await create("Của Alice");

    state.adminId = bob;
    expect(await deleteExercise(id)).toMatchObject({
      status: "error",
      message: MESSAGES.NOT_FOUND,
    });
    expect(await db.select().from(exerciseLibrary)).toHaveLength(1);

    state.adminId = alice;
    expect(await deleteExercise(id)).toEqual({ status: "success" });
    expect(await db.select().from(exerciseLibrary)).toEqual([]);
    // Gone: a second delete is "not found", not a crash.
    expect(await deleteExercise(id)).toMatchObject({
      status: "error",
      message: MESSAGES.NOT_FOUND,
    });
  });
});

describe("getExercise", () => {
  it("returns a built-in with its steps", async () => {
    const result = await getExercise("b:3_4_Sit-Up");

    expect(result).toMatchObject({
      status: "success",
      exercise: {
        ref: "b:3_4_Sit-Up",
        name: "3/4 Sit-Up",
        primary: ["abdominals"],
        isCustom: false,
        customId: null,
        level: "beginner",
      },
    });
    expect(
      result.status === "success" && result.exercise.instructions,
    ).toHaveLength(5);
  });

  it("returns a custom exercise split into steps, only to its owner", async () => {
    const id = await create("Kéo xà", { instructions: "Bước 1\n\n Bước 2 " });

    expect(await getExercise(`c:${id}`)).toMatchObject({
      status: "success",
      exercise: {
        name: "Kéo xà",
        isCustom: true,
        customId: id,
        instructions: ["Bước 1", "Bước 2"],
      },
    });
    state.adminId = bob;
    expect(await getExercise(`c:${id}`)).toMatchObject({
      status: "error",
      message: MESSAGES.NOT_FOUND,
    });
  });

  it("answers not found for unknown or malformed refs", async () => {
    for (const ref of ["b:nope", "c:999", "c:abc", "", "x:1"]) {
      expect(await getExercise(ref)).toMatchObject({
        status: "error",
        message: MESSAGES.NOT_FOUND,
      });
    }
  });
});

describe("searchExercises", () => {
  it("lists the caller's custom exercises first, then built-ins", async () => {
    await create("Squat riêng");
    const result = await searchExercises({ q: "squat", limit: 5 });

    expect(result.status).toBe("success");
    const rows = result.status === "success" ? result.rows : [];

    expect(rows).toHaveLength(5);
    expect(rows[0]).toMatchObject({ name: "Squat riêng", isCustom: true });
    expect(rows.slice(1).every((row) => !row.isCustom)).toBe(true);
    expect(rows.slice(1).every((row) => row.ref.startsWith("b:"))).toBe(true);
  });

  it("never shows another admin's custom exercises", async () => {
    await create("Bài bí mật");
    state.adminId = bob;
    const result = await searchExercises({ q: "bí mật" });

    expect(result).toEqual({ status: "success", rows: [] });
  });

  it("filters by muscle and source", async () => {
    await create("Kéo xà", { primary: ["lats"] });
    const mine = await searchExercises({ q: "", source: "mine" });
    const neck = await searchExercises({
      q: "",
      muscle: "neck",
      source: "builtin",
      limit: 100,
    });

    expect(mine).toMatchObject({
      status: "success",
      rows: [{ name: "Kéo xà", primary: ["lats"], secondary: ["biceps"] }],
    });
    expect(neck.status === "success" && neck.rows.length).toBeGreaterThan(0);
    expect(
      neck.status === "success" &&
        neck.rows.every(
          (row) =>
            row.primary.includes("neck") || row.secondary.includes("neck"),
        ),
    ).toBe(true);
  });

  it("gives built-ins an image URL and a custom photo a versioned URL", async () => {
    const id = await create("Có ảnh", { photo: WEBP_1X1 });
    const mine = await searchExercises({ q: "có ảnh" });
    const builtin = await searchExercises({ q: "3/4 sit-up", limit: 1 });

    expect(mine).toMatchObject({
      rows: [
        {
          imageUrl: expect.stringMatching(
            new RegExp(`^/api/exercises/${id}/photo\\?v=\\d+$`),
          ),
        },
      ],
    });
    expect(builtin).toMatchObject({
      rows: [
        {
          imageUrl:
            "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/3_4_Sit-Up/0.jpg",
        },
      ],
    });
  });

  it("rejects an out-of-range limit", async () => {
    expect(await searchExercises({ q: "", limit: 1000 })).toMatchObject({
      status: "error",
      message: MESSAGES.INVALID_INPUT,
    });
  });
});
