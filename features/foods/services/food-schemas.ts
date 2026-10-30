import { z } from "zod";

import {
  FOOD_GROUP_ORDER,
  FOOD_LIMITS,
  FOOD_MESSAGES,
} from "@/features/foods/constants/foods";
import type { FoodGroup } from "@/features/foods/types/food";
import {
  describeKcalGap,
  isKcalGapTooLarge,
} from "@/features/foods/utils/food-math";
import { normalizeName } from "@/utils/name";

// Accepts "3,6" as well as "3.6" (Vietnamese decimal comma). Empty, text and
// out of range values give a Vietnamese message on that field.
const numberField = (label: string, max: number) =>
  z
    .string()
    .trim()
    .min(1, `Nhập ${label}`)
    .transform((value) => Number(value.replace(",", ".")))
    .pipe(
      z
        .number({ error: `${label} phải là số` })
        .min(0, `${label} không được âm`)
        .max(max, `${label} tối đa ${max}`),
    );

const optionalNumberField = (label: string, max: number) =>
  z
    .string()
    .trim()
    .optional()
    .transform((value) => value ?? "")
    .pipe(
      z.union([z.literal("").transform(() => null), numberField(label, max)]),
    );

const optionalText = (label: string, max: number) =>
  z
    .string()
    .optional()
    .transform((value) => normalizeName(value ?? ""))
    .pipe(z.string().max(max, `${label} tối đa ${max} ký tự`));

export const foodFormSchema = z
  .object({
    name: z
      .string()
      .transform(normalizeName)
      .pipe(
        z
          .string()
          .min(1, "Nhập tên món")
          .max(
            FOOD_LIMITS.NAME_MAX,
            `Tên tối đa ${FOOD_LIMITS.NAME_MAX} ký tự`,
          ),
      ),
    group: z.enum(FOOD_GROUP_ORDER as [FoodGroup, ...FoodGroup[]], {
      error: "Chọn nhóm món",
    }),
    state: z
      .enum(["", "raw", "cooked"], { error: "Chọn trạng thái hợp lệ" })
      .optional()
      .transform((value) => (value ? value : null)),
    kcal: numberField("Calo", FOOD_LIMITS.MAX_KCAL_PER_100G),
    protein: numberField("Protein", FOOD_LIMITS.MAX_GRAMS_PER_100G),
    carbs: numberField("Carb", FOOD_LIMITS.MAX_GRAMS_PER_100G),
    fat: numberField("Fat", FOOD_LIMITS.MAX_GRAMS_PER_100G),
    fiber: optionalNumberField("Chất xơ", FOOD_LIMITS.MAX_GRAMS_PER_100G),
    servingLabel: optionalText("Tên khẩu phần", FOOD_LIMITS.SERVING_LABEL_MAX),
    servingGrams: optionalNumberField(
      "Khối lượng khẩu phần",
      FOOD_LIMITS.MAX_SERVING_GRAMS,
    ),
    source: optionalText("Nguồn", FOOD_LIMITS.SOURCE_MAX),
    // Checkbox: present ("on") when ticked.
    confirmed: z
      .string()
      .optional()
      .transform((value) => value === "on"),
  })
  .superRefine((food, context) => {
    const areNumbersInRange =
      [food.kcal, food.protein, food.carbs, food.fat].every(
        (value) => value >= 0 && value <= FOOD_LIMITS.MAX_KCAL_PER_100G,
      ) &&
      [food.protein, food.carbs, food.fat].every(
        (value) => value <= FOOD_LIMITS.MAX_GRAMS_PER_100G,
      );

    if (
      areNumbersInRange &&
      food.protein + food.carbs + food.fat > FOOD_LIMITS.MAX_GRAMS_PER_100G
    ) {
      context.addIssue({
        code: "custom",
        path: ["fat"],
        message: "Protein + carb + fat không vượt quá 100 g trên 100 g",
      });
    }

    const hasLabel = food.servingLabel !== "";
    const hasGrams = food.servingGrams !== null;

    if (hasLabel && !hasGrams) {
      context.addIssue({
        code: "custom",
        path: ["servingGrams"],
        message: "Nhập khối lượng khẩu phần (gram)",
      });
    }
    if (hasGrams && !hasLabel) {
      context.addIssue({
        code: "custom",
        path: ["servingLabel"],
        message: "Nhập tên khẩu phần, ví dụ 1 tô",
      });
    }
    if (hasGrams && food.servingGrams === 0) {
      context.addIssue({
        code: "custom",
        path: ["servingGrams"],
        message: "Khối lượng khẩu phần phải lớn hơn 0",
      });
    }

    // Only compare the kcal when every number is valid on its own.
    if (
      areNumbersInRange &&
      !food.confirmed &&
      isKcalGapTooLarge(food.kcal, food)
    ) {
      context.addIssue({
        code: "custom",
        path: ["kcal"],
        message: `${describeKcalGap(food.kcal, food)} Kiểm tra lại hoặc tick "${FOOD_MESSAGES.CONFIRM_LABEL}".`,
      });
    }
  });

export type FoodFormValues = z.output<typeof foodFormSchema>;

export const foodIdSchema = z.coerce.number().int().positive();
