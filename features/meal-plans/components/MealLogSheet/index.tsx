"use client";

import { ArrowLeft, PencilLine, Plus, Search } from "lucide-react";
import type { FormEvent } from "react";

import { BottomSheet } from "@/components/common/BottomSheet";
import {
  BUTTON_PRIMARY,
  BUTTON_SECONDARY,
  FIELD_ERROR,
  INPUT,
  LABEL,
} from "@/constants/styles";
import {
  FOOD_GROUPS,
  FOOD_STATE_LABELS,
} from "@/features/foods/constants/foods";
import { MEAL_LOG_LIMITS } from "@/features/meal-plans/constants/meal-plans";
import { useMealLogSheet } from "@/features/meal-plans/hooks/use-meal-log-sheet";
import type { MealLog } from "@/features/meal-plans/types/meal-log";
import type { PlanFood } from "@/features/meal-plans/types/meal-plan";

interface MealLogSheetProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  mealId: number;
  mealName: string;
  library: PlanFood[];
  // The log being edited; null adds a new one.
  editing: MealLog | null;
}

const MACRO_INPUTS = [
  { field: "kcal", label: "Calo (kcal)" },
  { field: "protein", label: "Protein (g)" },
  { field: "carbs", label: "Carb (g)" },
  { field: "fat", label: "Fat (g)" },
] as const;

type BodyProps = Omit<MealLogSheetProps, "isOpen">;

// Remounted on every open (see below), so each open starts clean.
const MealLogSheetBody = ({
  onOpenChange,
  mealId,
  library,
  editing,
}: BodyProps) => {
  const form = useMealLogSheet(mealId, library, editing, () =>
    onOpenChange(false),
  );

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    form.submit();
  };

  if (form.step === "search") {
    const { picker } = form;

    return (
      <div className="space-y-3">
        <label htmlFor="log-search" className="sr-only">
          Tìm món trong thư viện
        </label>
        <div className="relative">
          <Search
            className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted"
            aria-hidden
          />
          <input
            id="log-search"
            type="search"
            value={picker.query}
            onChange={(event) => picker.setQuery(event.target.value)}
            placeholder="Tìm món (VD: uc ga)"
            autoComplete="off"
            className={`${INPUT} pl-11`}
          />
        </div>
        {picker.isSearching &&
          (picker.results.length ? (
            <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line">
              {picker.results.map((food) => (
                <li key={food.id}>
                  <button
                    type="button"
                    onClick={() => form.pick(food)}
                    className="flex min-h-12 w-full items-center gap-3 px-3 py-2 text-left transition active:bg-line"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block text-[15px] leading-snug text-fg">
                        {food.name}
                      </span>
                      <span className="block text-xs text-muted">
                        {FOOD_GROUPS[food.group].label}
                        {food.state
                          ? ` · ${FOOD_STATE_LABELS[food.state]}`
                          : ""}
                        {" · "}
                        {food.kcal} kcal/100 g
                      </span>
                    </span>
                    <Plus className="size-5 shrink-0 text-accent" aria-hidden />
                    <span className="sr-only">Chọn {food.name}</span>
                  </button>
                </li>
              ))}
              {picker.hasMore && (
                <li className="px-3 py-2 text-xs text-muted">
                  Còn nhiều món nữa, gõ thêm để thu hẹp.
                </li>
              )}
            </ul>
          ) : (
            <p className="px-1 text-sm text-muted">Không tìm thấy món nào</p>
          ))}
        <button
          type="button"
          onClick={() => form.goTo("free")}
          className={`${BUTTON_SECONDARY} w-full border-dashed`}
        >
          <PencilLine className="size-5" aria-hidden />
          Món không có trong thư viện
        </button>
      </div>
    );
  }

  if (form.step === "amount") {
    const name = form.food?.name ?? editing?.name ?? "";

    return (
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <p className="text-[15px] font-medium text-fg">{name}</p>
        <div>
          <label htmlFor="log-grams" className={LABEL}>
            Số gram
          </label>
          <input
            id="log-grams"
            value={form.gramsText}
            onChange={(event) => form.setGramsText(event.target.value)}
            inputMode="decimal"
            autoFocus
            className={INPUT}
          />
          {form.error && <p className={FIELD_ERROR}>{form.error}</p>}
        </div>
        <div className="grid grid-cols-1 gap-2">
          <button
            type="submit"
            disabled={form.isPending}
            className={BUTTON_PRIMARY}
          >
            {editing ? "Lưu" : "Thêm món"}
          </button>
          {!editing && (
            <button
              type="button"
              onClick={() => form.goTo("search")}
              className={BUTTON_SECONDARY}
            >
              <ArrowLeft className="size-5" aria-hidden />
              Chọn món khác
            </button>
          )}
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <div>
        <label htmlFor="log-name" className={LABEL}>
          Tên món
        </label>
        <input
          id="log-name"
          value={form.name}
          onChange={(event) => form.setName(event.target.value)}
          maxLength={MEAL_LOG_LIMITS.CUSTOM_NAME}
          placeholder="VD: Phở bò"
          className={INPUT}
        />
      </div>
      <div>
        <label htmlFor="log-free-grams" className={LABEL}>
          Số gram (nếu biết)
        </label>
        <input
          id="log-free-grams"
          value={form.gramsText}
          onChange={(event) => form.setGramsText(event.target.value)}
          inputMode="decimal"
          className={INPUT}
        />
      </div>
      <fieldset className="space-y-3">
        <legend className="text-sm font-medium text-fg">
          Dinh dưỡng (không bắt buộc)
        </legend>
        <div className="grid grid-cols-2 gap-3">
          {MACRO_INPUTS.map(({ field, label }) => (
            <div key={field}>
              <label htmlFor={`log-${field}`} className="sr-only">
                {label}
              </label>
              <input
                id={`log-${field}`}
                value={form.macros[field]}
                onChange={(event) => form.setMacro(field, event.target.value)}
                inputMode="decimal"
                placeholder={label}
                className={INPUT}
              />
            </div>
          ))}
        </div>
      </fieldset>
      {form.error && <p className={FIELD_ERROR}>{form.error}</p>}
      <div className="grid grid-cols-1 gap-2">
        <button
          type="submit"
          disabled={form.isPending}
          className={BUTTON_PRIMARY}
        >
          {editing ? "Lưu" : "Thêm món"}
        </button>
        {!editing && (
          <button
            type="button"
            onClick={() => form.goTo("search")}
            className={BUTTON_SECONDARY}
          >
            <ArrowLeft className="size-5" aria-hidden />
            Tìm trong thư viện
          </button>
        )}
      </div>
    </form>
  );
};

// "Thêm món đã ăn" / "Sửa món": search the library (accent-free) and enter
// grams, or type a free food. Remounted per log so the fields start from it.
export const MealLogSheet = ({
  isOpen,
  onOpenChange,
  mealId,
  mealName,
  library,
  editing,
}: MealLogSheetProps) => (
  <BottomSheet
    isOpen={isOpen}
    onOpenChange={onOpenChange}
    title={editing ? "Sửa món" : "Ghi món đã ăn"}
    description={mealName}
  >
    <MealLogSheetBody
      key={editing?.id ?? "new"}
      onOpenChange={onOpenChange}
      mealId={mealId}
      mealName={mealName}
      library={library}
      editing={editing}
    />
  </BottomSheet>
);
