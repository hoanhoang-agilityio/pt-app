"use client";

import clsx from "clsx";

import { CARD, INPUT, LABEL } from "@/constants/styles";
import { FOOD_LIMITS } from "@/features/foods/constants/foods";
import { useFoodAmount } from "@/features/foods/hooks/use-food-amount";
import type { Food } from "@/features/foods/types/food";
import { formatGrams, formatKcal } from "@/features/foods/utils/food-math";
import {
  MACRO_COLORS,
  MACRO_LABELS,
} from "@/features/nutrition/constants/nutrition";

interface FoodAmountCalculatorProps {
  food: Food;
}

const MACRO_ORDER = ["protein", "carbs", "fat"] as const;

const UNIT_BUTTON = "min-h-10 rounded-lg text-sm font-semibold transition";

// Type grams (or servings) and see the calories and macros for that amount.
export const FoodAmountCalculator = ({ food }: FoodAmountCalculatorProps) => {
  const { unit, changeUnit, text, setText, isValid, result } =
    useFoodAmount(food);
  const hasServing = Boolean(food.servingLabel && food.servingGrams);
  const unitLabel =
    unit === "servings" && food.servingLabel ? food.servingLabel : "gram";

  return (
    <section className={`${CARD} space-y-4 p-4`} aria-labelledby="amount-title">
      <h2 id="amount-title" className="text-lg font-bold text-fg">
        Tính theo khối lượng
      </h2>

      {hasServing && (
        <div className="grid grid-cols-2 gap-1 rounded-xl bg-line/60 p-1">
          {(["grams", "servings"] as const).map((item) => (
            <button
              key={item}
              type="button"
              aria-pressed={unit === item}
              onClick={() => changeUnit(item)}
              className={clsx(
                UNIT_BUTTON,
                unit === item ? "bg-surface text-fg shadow-sm" : "text-muted",
              )}
            >
              {item === "grams" ? "Gram" : `Khẩu phần (${food.servingLabel})`}
            </button>
          ))}
        </div>
      )}

      <div>
        <label htmlFor="food-amount" className={LABEL}>
          {unit === "servings" ? "Số khẩu phần" : "Khối lượng (gram)"}
        </label>
        <div className="relative">
          <input
            id="food-amount"
            value={text}
            onChange={(event) => setText(event.target.value)}
            inputMode="decimal"
            autoComplete="off"
            aria-invalid={!isValid}
            aria-describedby="amount-hint"
            className={`${INPUT} pr-24`}
          />
          <span className="pointer-events-none absolute top-1/2 right-4 max-w-20 -translate-y-1/2 truncate text-sm text-muted">
            {unitLabel}
          </span>
        </div>
        <p
          id="amount-hint"
          className={clsx(
            "mt-1.5 text-sm",
            isValid ? "text-muted" : "text-danger",
          )}
        >
          {isValid
            ? `= ${formatGrams(result.grams)} g`
            : `Nhập số từ 0 đến ${FOOD_LIMITS.MAX_AMOUNT_GRAMS} g`}
        </p>
      </div>

      <dl className="space-y-3" aria-live="polite">
        <div className="flex items-baseline justify-between rounded-xl bg-line/50 px-4 py-3">
          <dt className="font-semibold text-fg">Calo</dt>
          <dd className="text-2xl font-bold text-fg tabular-nums">
            {formatKcal(result.kcal)}{" "}
            <span className="text-sm font-medium text-muted">kcal</span>
          </dd>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {MACRO_ORDER.map((macro) => (
            <div
              key={macro}
              className={clsx(
                "rounded-xl px-2 py-3 text-center",
                MACRO_COLORS[macro].soft,
              )}
            >
              <dt
                className={clsx(
                  "text-xs font-semibold",
                  MACRO_COLORS[macro].text,
                )}
              >
                {MACRO_LABELS[macro].name}
              </dt>
              <dd className="mt-0.5 text-lg font-bold text-fg tabular-nums">
                {formatGrams(result[macro])}
                <span className="text-xs font-medium text-muted"> g</span>
              </dd>
            </div>
          ))}
        </div>
      </dl>
    </section>
  );
};
