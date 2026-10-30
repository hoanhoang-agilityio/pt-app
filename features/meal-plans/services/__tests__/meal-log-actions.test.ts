import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createTestDb, type TestDb } from "@/db/__tests__/create-test-db";
import {
  foods,
  mealLogs,
  mealMarks,
  mealPlanDays,
  mealPlanItems,
  mealPlanMeals,
  nutritionTargets,
  users,
} from "@/db/schema";

const state = vi.hoisted(() => ({
  db: null as unknown,
  role: "user",
  userId: 1,
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/services/session", () => ({
  readSession: vi.fn(async () =>
    state.role === "admin"
      ? { role: "admin", adminId: 1 }
      : { role: "user", userId: state.userId },
  ),
}));
vi.mock("@/services/admins", () => ({
  findAdminById: vi.fn(async (id: number) => ({ id, username: "pt" })),
}));
vi.mock("@/services/users", async () => {
  const { eq: equals } = await import("drizzle-orm");
  const schema = await import("@/db/schema");

  return {
    findUserById: async (id: number) => {
      const db = state.db as TestDb;
      const [row] = await db
        .select()
        .from(schema.users)
        .where(equals(schema.users.id, id));

      return row ?? null;
    },
  };
});
vi.mock("@/db", () => ({
  db: new Proxy(
    {},
    { get: (_target, property) => Reflect.get(state.db as object, property) },
  ),
}));

const logActions =
  await import("@/features/meal-plans/services/meal-log-actions");
const planActions =
  await import("@/features/meal-plans/services/meal-plan-actions");
const { getMealLogData } =
  await import("@/features/meal-plans/services/meal-log-queries");
const { getPlanKcalNoticesFrom } =
  await import("@/features/meal-plans/services/meal-plan-queries");
const { getTodayDate, addDays } = await import("@/utils/week");
const { TIME_ZONE } = await import("@/constants/time");

let db: TestDb;

const TODAY = getTodayDate(TIME_ZONE);
const TOMORROW = addDays(TODAY, 1);

const seed = async () => {
  const [member, other] = await db
    .insert(users)
    .values([
      { name: "Member", nameKey: "member" },
      { name: "Other", nameKey: "other" },
    ])
    .returning();
  const [chicken, rice] = await db
    .insert(foods)
    .values([
      {
        name: "Ức gà (chín)",
        nameKey: "uc ga (chin)",
        group: "meat",
        kcal: 165,
        protein: 31,
        carbs: 0,
        fat: 3.6,
        source: "test",
      },
      {
        name: "Cơm trắng (chín)",
        nameKey: "com trang (chin)",
        group: "starch",
        kcal: 130,
        protein: 2.7,
        carbs: 28.2,
        fat: 0.3,
        source: "test",
      },
    ])
    .returning();

  const addPlan = async (userId: number, date: string) => {
    const [day] = await db
      .insert(mealPlanDays)
      .values({ userId, date })
      .returning();
    const meals = await db
      .insert(mealPlanMeals)
      .values([
        { dayId: day.id, position: 0, name: "Bữa sáng" },
        { dayId: day.id, position: 1, name: "Bữa trưa" },
      ])
      .returning();

    return { day, meals };
  };

  const today = await addPlan(member.id, TODAY);
  const tomorrow = await addPlan(member.id, TOMORROW);
  const foreign = await addPlan(other.id, TODAY);

  return { member, other, chicken, rice, today, tomorrow, foreign };
};

const loginAs = (userId: number) => {
  state.role = "user";
  state.userId = userId;
};

const expectRedirect = async (call: Promise<unknown>) => {
  await expect(call).rejects.toMatchObject({
    digest: expect.stringContaining("NEXT_REDIRECT"),
  });
};

const countLogs = async () => (await db.select().from(mealLogs)).length;

beforeEach(async () => {
  db = await createTestDb();
  state.db = db;
  state.role = "user";
});

describe("addMealLogAction", () => {
  it("logs a library food with grams and resolves its numbers", async () => {
    const { member, chicken, today } = await seed();

    loginAs(member.id);
    expect(
      await logActions.addMealLogAction({
        kind: "library",
        mealId: today.meals[0].id,
        foodId: chicken.id,
        grams: 200,
      }),
    ).toEqual({ status: "success" });

    const { logs } = await getMealLogData([today.meals[0].id]);

    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({
      name: "Ức gà (chín)",
      isFree: false,
      grams: 200,
      nutrition: { kcal: 330, protein: 62, carbs: 0, fat: 7.2 },
    });
  });

  it("logs a free food with optional macros and trims the name", async () => {
    const { member, today } = await seed();

    loginAs(member.id);
    await logActions.addMealLogAction({
      kind: "free",
      mealId: today.meals[0].id,
      customName: "  Phở   bò ",
      grams: 0,
      kcal: 450,
      protein: 25,
    });
    await logActions.addMealLogAction({
      kind: "free",
      mealId: today.meals[0].id,
      customName: "Bánh mì",
      grams: 120,
    });

    const { logs } = await getMealLogData([today.meals[0].id]);

    expect(logs.map((log) => log.name)).toEqual(["Phở bò", "Bánh mì"]);
    expect(logs[0]).toMatchObject({
      isFree: true,
      nutrition: { kcal: 450, protein: 25, carbs: 0, fat: 0 },
    });
    // No numbers typed: nothing to add up.
    expect(logs[1].nutrition).toBeNull();
  });

  it("rejects a meal of another trainee and stores nothing", async () => {
    const { member, chicken, foreign } = await seed();

    loginAs(member.id);

    const result = await logActions.addMealLogAction({
      kind: "library",
      mealId: foreign.meals[0].id,
      foodId: chicken.id,
      grams: 100,
    });

    expect(result).toMatchObject({
      status: "error",
      message: "Bữa này không còn trong plan của bạn",
    });
    expect(await countLogs()).toBe(0);
  });

  it("rejects a meal id that does not exist", async () => {
    const { member, chicken } = await seed();

    loginAs(member.id);
    expect(
      await logActions.addMealLogAction({
        kind: "library",
        mealId: 9999,
        foodId: chicken.id,
        grams: 100,
      }),
    ).toMatchObject({ status: "error" });
  });

  it("rejects a meal of a plan day after today", async () => {
    const { member, chicken, tomorrow } = await seed();

    loginAs(member.id);
    expect(
      await logActions.addMealLogAction({
        kind: "library",
        mealId: tomorrow.meals[0].id,
        foodId: chicken.id,
        grams: 100,
      }),
    ).toMatchObject({
      status: "error",
      message: "Chưa tới ngày này, quay lại ghi sau nhé",
    });
    expect(await countLogs()).toBe(0);
  });

  it("rejects a food that is archived or missing", async () => {
    const { member, chicken, today } = await seed();

    loginAs(member.id);
    await db
      .update(foods)
      .set({ archivedAt: new Date() })
      .where(eq(foods.id, chicken.id));

    for (const foodId of [chicken.id, 9999]) {
      expect(
        await logActions.addMealLogAction({
          kind: "library",
          mealId: today.meals[0].id,
          foodId,
          grams: 100,
        }),
      ).toMatchObject({
        status: "error",
        message: "Món này không còn trong thư viện",
      });
    }
    expect(await countLogs()).toBe(0);
  });

  it("rejects bad numbers: zero grams, too many grams, negative or huge macros, empty name", async () => {
    const { member, chicken, today } = await seed();
    const mealId = today.meals[0].id;

    loginAs(member.id);

    const bad = [
      { kind: "library", mealId, foodId: chicken.id, grams: 0 },
      { kind: "library", mealId, foodId: chicken.id, grams: 3001 },
      { kind: "library", mealId, foodId: chicken.id, grams: Number.NaN },
      { kind: "free", mealId, customName: "Cơm", grams: 100, protein: -1 },
      { kind: "free", mealId, customName: "Cơm", grams: 100, kcal: 5001 },
      { kind: "free", mealId, customName: "   ", grams: 100 },
      { kind: "free", mealId, customName: "x".repeat(61), grams: 100 },
      { kind: "free", mealId, customName: "Cơm", grams: -5 },
    ] as const;

    for (const input of bad) {
      expect(await logActions.addMealLogAction(input)).toMatchObject({
        status: "error",
        message: "Vui lòng kiểm tra lại thông tin",
      });
    }
    expect(await countLogs()).toBe(0);
  });

  it("allows at most 30 foods in a meal", async () => {
    const { member, today } = await seed();
    const mealId = today.meals[0].id;

    await db.insert(mealLogs).values(
      Array.from({ length: 30 }, (_, index) => ({
        userId: member.id,
        mealId,
        customName: `Món ${index}`,
        grams: 10,
      })),
    );
    loginAs(member.id);
    expect(
      await logActions.addMealLogAction({
        kind: "free",
        mealId,
        customName: "Thêm",
        grams: 10,
      }),
    ).toMatchObject({ status: "error", message: "Một bữa tối đa 30 món" });
    expect(await countLogs()).toBe(30);
  });

  it("sends a signed-out visitor and an admin to login", async () => {
    const { chicken, today } = await seed();

    state.role = "admin";
    await expectRedirect(
      logActions.addMealLogAction({
        kind: "library",
        mealId: today.meals[0].id,
        foodId: chicken.id,
        grams: 100,
      }),
    );
    expect(await countLogs()).toBe(0);
  });
});

describe("updateMealLogAction", () => {
  const logChicken = async () => {
    const data = await seed();

    loginAs(data.member.id);
    await logActions.addMealLogAction({
      kind: "library",
      mealId: data.today.meals[0].id,
      foodId: data.chicken.id,
      grams: 200,
    });

    const [log] = await db.select().from(mealLogs);

    return { ...data, log };
  };

  it("changes the grams of a library food and keeps its food", async () => {
    const { log, chicken } = await logChicken();

    expect(
      await logActions.updateMealLogAction({
        logId: log.id,
        grams: 150,
        // A name sent for a library food is ignored.
        customName: "Hack",
      }),
    ).toEqual({ status: "success" });

    const [row] = await db.select().from(mealLogs);

    expect(row).toMatchObject({
      grams: 150,
      foodId: chicken.id,
      customName: null,
    });
  });

  it("rejects 0 g for a library food", async () => {
    const { log } = await logChicken();

    expect(
      await logActions.updateMealLogAction({ logId: log.id, grams: 0 }),
    ).toMatchObject({ status: "error" });
    expect((await db.select().from(mealLogs))[0].grams).toBe(200);
  });

  it("edits a free food's name, grams and macros, and can clear the macros", async () => {
    const { member, today } = await seed();

    loginAs(member.id);
    await logActions.addMealLogAction({
      kind: "free",
      mealId: today.meals[0].id,
      customName: "Phở",
      grams: 0,
      kcal: 450,
    });

    const [log] = await db.select().from(mealLogs);

    await logActions.updateMealLogAction({
      logId: log.id,
      customName: "Phở gà",
      grams: 500,
      protein: 30,
    });
    expect((await db.select().from(mealLogs))[0]).toMatchObject({
      customName: "Phở gà",
      grams: 500,
      kcal: null,
      protein: 30,
    });
    // A free food needs a name.
    expect(
      await logActions.updateMealLogAction({ logId: log.id, grams: 500 }),
    ).toMatchObject({ status: "error", message: "Nhập tên món" });
  });

  it("cannot edit another trainee's log or a log that is gone", async () => {
    const { other, foreign, log } = await logChicken();

    await db.insert(mealLogs).values({
      userId: other.id,
      mealId: foreign.meals[0].id,
      customName: "Của người khác",
      grams: 100,
    });

    const [, theirs] = await db.select().from(mealLogs);

    for (const logId of [theirs.id, 9999]) {
      expect(
        await logActions.updateMealLogAction({
          logId,
          customName: "X",
          grams: 1,
        }),
      ).toMatchObject({
        status: "error",
        message: "Món này không còn trong nhật ký",
      });
    }
    expect((await db.select().from(mealLogs))[1].customName).toBe(
      "Của người khác",
    );
    expect(log.grams).toBe(200);
  });

  it("cannot edit a log of a day after today", async () => {
    const { member, tomorrow } = await seed();

    await db.insert(mealLogs).values({
      userId: member.id,
      mealId: tomorrow.meals[0].id,
      customName: "Sớm",
      grams: 10,
    });

    const [log] = await db.select().from(mealLogs);

    loginAs(member.id);
    expect(
      await logActions.updateMealLogAction({
        logId: log.id,
        customName: "Sớm hơn",
        grams: 20,
      }),
    ).toMatchObject({ status: "error" });
    expect((await db.select().from(mealLogs))[0].grams).toBe(10);
  });
});

describe("removeMealLogAction", () => {
  it("removes the trainee's log only", async () => {
    const { member, other, today, foreign } = await seed();

    await db.insert(mealLogs).values([
      {
        userId: member.id,
        mealId: today.meals[0].id,
        customName: "A",
        grams: 1,
      },
      {
        userId: other.id,
        mealId: foreign.meals[0].id,
        customName: "B",
        grams: 1,
      },
    ]);

    const [mine, theirs] = await db.select().from(mealLogs);

    loginAs(member.id);
    expect(await logActions.removeMealLogAction({ logId: mine.id })).toEqual({
      status: "success",
    });
    expect(
      await logActions.removeMealLogAction({ logId: theirs.id }),
    ).toMatchObject({ status: "error" });
    expect(
      await logActions.removeMealLogAction({ logId: mine.id }),
    ).toMatchObject({ status: "error" });
    expect((await db.select().from(mealLogs)).map((row) => row.id)).toEqual([
      theirs.id,
    ]);
  });
});

describe("setMealMarkAction", () => {
  it("marks Đạt, then updates the same row with a note", async () => {
    const { member, today } = await seed();
    const mealId = today.meals[0].id;

    loginAs(member.id);
    await logActions.setMealMarkAction({ mealId, achieved: true, note: "" });
    await logActions.setMealMarkAction({
      mealId,
      achieved: true,
      note: "  Cơm hơi dư 30 g  ",
    });

    const rows = await db.select().from(mealMarks);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      mealId,
      userId: member.id,
      achieved: true,
      note: "Cơm hơi dư 30 g",
    });
  });

  it("keeps a note without Đạt, and removes the mark when both are cleared", async () => {
    const { member, today } = await seed();
    const mealId = today.meals[0].id;

    loginAs(member.id);
    await logActions.setMealMarkAction({
      mealId,
      achieved: false,
      note: "Thiếu gà",
    });
    expect(await getMealLogData([mealId])).toMatchObject({
      marks: [{ mealId, achieved: false, note: "Thiếu gà" }],
    });

    await logActions.setMealMarkAction({ mealId, achieved: false, note: "" });
    expect((await getMealLogData([mealId])).marks).toEqual([]);
  });

  it("rejects a foreign meal, a future day and a too long note", async () => {
    const { member, today, tomorrow, foreign } = await seed();

    loginAs(member.id);
    for (const mealId of [foreign.meals[0].id, tomorrow.meals[0].id, 9999]) {
      expect(
        await logActions.setMealMarkAction({
          mealId,
          achieved: true,
          note: "",
        }),
      ).toMatchObject({ status: "error" });
    }
    expect(
      await logActions.setMealMarkAction({
        mealId: today.meals[0].id,
        achieved: true,
        note: "x".repeat(301),
      }),
    ).toMatchObject({
      status: "error",
      message: "Vui lòng kiểm tra lại thông tin",
    });
    expect(await db.select().from(mealMarks)).toHaveLength(0);
  });
});

describe("when the PT changes the plan", () => {
  const seedWithLogs = async () => {
    const data = await seed();
    const [meal] = data.today.meals;

    await db.insert(mealLogs).values({
      userId: data.member.id,
      mealId: meal.id,
      foodId: data.chicken.id,
      grams: 100,
    });
    await db.insert(mealMarks).values({
      mealId: meal.id,
      userId: data.member.id,
      achieved: true,
    });
    return data;
  };

  it("deleting the plan day deletes its logs and marks, not other days'", async () => {
    const data = await seedWithLogs();

    await db.insert(mealLogs).values({
      userId: data.other.id,
      mealId: data.foreign.meals[0].id,
      customName: "Giữ",
      grams: 1,
    });
    state.role = "admin";
    expect(
      await planActions.deleteDayPlanAction({
        userId: data.member.id,
        dayId: data.today.day.id,
      }),
    ).toEqual({ status: "success" });
    expect(
      (await db.select().from(mealLogs)).map((row) => row.customName),
    ).toEqual(["Giữ"]);
    expect(await db.select().from(mealMarks)).toHaveLength(0);
  });

  it("removing one meal deletes only that meal's logs and marks", async () => {
    const data = await seedWithLogs();

    await db.insert(mealLogs).values({
      userId: data.member.id,
      mealId: data.today.meals[1].id,
      customName: "Bữa trưa",
      grams: 1,
    });
    state.role = "admin";
    await planActions.removeMealAction({
      userId: data.member.id,
      mealId: data.today.meals[0].id,
    });
    expect(
      (await db.select().from(mealLogs)).map((row) => row.customName),
    ).toEqual(["Bữa trưa"]);
    expect(await db.select().from(mealMarks)).toHaveLength(0);
  });

  it("copying a day over a day with logs replaces its logs; the trainee can no longer edit them", async () => {
    const data = await seedWithLogs();
    const tomorrowMeal = data.tomorrow.meals[0];

    await db.insert(mealPlanItems).values({
      mealId: tomorrowMeal.id,
      foodId: data.rice.id,
      grams: 100,
    });
    state.role = "admin";
    // Copy tomorrow's plan over today's.
    await planActions.copyDayAction({
      userId: data.member.id,
      dayId: data.tomorrow.day.id,
      dates: [TODAY],
    });
    expect(await db.select().from(mealLogs)).toHaveLength(0);
    expect(await db.select().from(mealMarks)).toHaveLength(0);

    loginAs(data.member.id);
    expect(
      await logActions.setMealMarkAction({
        mealId: data.today.meals[0].id,
        achieved: true,
        note: "",
      }),
    ).toMatchObject({ status: "error" });
  });
});

describe("getPlanKcalNoticesFrom", () => {
  it("compares each planned day with the target that applies on its date", async () => {
    const { member, chicken, rice, today, tomorrow } = await seed();

    // Target P 160 / C 235 / F 55 = 640 + 940 + 495 = 2,075 kcal.
    await db.insert(nutritionTargets).values({
      userId: member.id,
      effectiveFrom: "2020-01-01",
      protein: 160,
      carbs: 235,
      fat: 55,
      source: "manual",
    });
    // Today: 1,000 g rice = P 27 / C 282 / F 3 = 1,263 kcal and 500 g chicken
    // = P 155 / C 0 / F 18 = 782 kcal: 2,045 kcal, gap -30, within 80.
    await db.insert(mealPlanItems).values([
      { mealId: today.meals[0].id, foodId: rice.id, grams: 1000 },
      { mealId: today.meals[1].id, foodId: chicken.id, grams: 500 },
      // Tomorrow: 500 g rice = 631.5 kcal -> gap -1,443.5 -> -1317.
      { mealId: tomorrow.meals[0].id, foodId: rice.id, grams: 600 },
    ]);

    expect(await getPlanKcalNoticesFrom(member.id, TODAY)).toEqual([
      { date: TOMORROW, gapKcal: -1317 },
    ]);

    // The PT raises the target from tomorrow on: +100 g carbs = +400 kcal.
    await db.insert(nutritionTargets).values({
      userId: member.id,
      effectiveFrom: TOMORROW,
      protein: 160,
      carbs: 335,
      fat: 55,
      source: "manual",
    });

    expect(await getPlanKcalNoticesFrom(member.id, TODAY)).toEqual([
      { date: TOMORROW, gapKcal: -1717 },
    ]);
    // Days before `from` are not checked.
    expect(await getPlanKcalNoticesFrom(member.id, TOMORROW)).toEqual([
      { date: TOMORROW, gapKcal: -1717 },
    ]);
  });

  it("is empty without plans or without a target", async () => {
    const { member, rice, today } = await seed();

    await db
      .insert(mealPlanItems)
      .values({ mealId: today.meals[0].id, foodId: rice.id, grams: 500 });
    expect(await getPlanKcalNoticesFrom(member.id, TODAY)).toEqual([]);
    expect(await getPlanKcalNoticesFrom(9999, TODAY)).toEqual([]);
  });
});
