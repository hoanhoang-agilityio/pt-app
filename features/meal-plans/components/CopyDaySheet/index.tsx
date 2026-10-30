"use client";

import { BottomSheet } from "@/components/common/BottomSheet";
import {
  BUTTON_DANGER,
  BUTTON_PRIMARY,
  BUTTON_SECONDARY,
} from "@/constants/styles";
import { useCopyDay } from "@/features/meal-plans/hooks/use-copy-day";
import {
  formatOverwriteLogWarning,
  formatOverwriteQuestion,
} from "@/features/meal-plans/utils/overwrite-message";
import { formatFullDay } from "@/utils/week";

interface CopyDaySheetProps {
  userId: number;
  dayId: number;
  sourceDate: string;
  // Dates offered (this week and next), without the source day.
  dates: string[];
  datesWithPlan: string[];
  // Dates where the trainee logged or marked meals: overwriting deletes those.
  datesWithLogs: string[];
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

export const CopyDaySheet = ({
  userId,
  dayId,
  sourceDate,
  dates,
  datesWithPlan,
  datesWithLogs,
  isOpen,
  onOpenChange,
}: CopyDaySheetProps) => {
  const copy = useCopyDay(userId, dayId, datesWithPlan, () =>
    onOpenChange(false),
  );

  const logWarning = formatOverwriteLogWarning(
    copy.overwriteDates,
    datesWithLogs,
  );

  return (
    <BottomSheet
      isOpen={isOpen}
      onOpenChange={(open) => {
        copy.cancel();
        onOpenChange(open);
      }}
      title="Sao chép sang ngày khác"
      description={`Từ ${formatFullDay(sourceDate)}`}
    >
      {copy.isConfirming ? (
        <div
          role="alertdialog"
          aria-label="Xác nhận ghi đè"
          className="space-y-4"
        >
          <p className="text-[15px] font-medium text-fg">
            {formatOverwriteQuestion(copy.overwriteDates)}
          </p>
          {logWarning && (
            <p className="text-sm font-medium text-warning">{logWarning}</p>
          )}
          <p className="text-sm text-muted">
            Plan cũ của các ngày này sẽ bị thay bằng plan của{" "}
            {formatFullDay(sourceDate)}.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={copy.cancel}
              className={BUTTON_SECONDARY}
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={copy.confirm}
              disabled={copy.isPending}
              className={BUTTON_DANGER}
            >
              Ghi đè
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <ul className="grid grid-cols-1 gap-2">
            {dates.map((date) => {
              const hasPlan = datesWithPlan.includes(date);

              return (
                <li key={date}>
                  <label className="flex min-h-12 items-center gap-3 rounded-xl border border-line bg-surface px-4 py-2">
                    <input
                      type="checkbox"
                      checked={copy.selected.includes(date)}
                      onChange={() => copy.toggle(date)}
                      className="size-5 accent-[var(--accent)]"
                    />
                    <span className="min-w-0 flex-1 text-[15px] text-fg">
                      {formatFullDay(date)}
                    </span>
                    {hasPlan && (
                      <span className="shrink-0 text-xs font-medium text-warning">
                        Đã có plan, sẽ ghi đè
                      </span>
                    )}
                  </label>
                </li>
              );
            })}
          </ul>
          <button
            type="button"
            onClick={copy.submit}
            disabled={copy.isPending || copy.selected.length === 0}
            className={`${BUTTON_PRIMARY} w-full`}
          >
            Sao chép
            {copy.selected.length > 0 && ` (${copy.selected.length} ngày)`}
          </button>
        </div>
      )}
    </BottomSheet>
  );
};
