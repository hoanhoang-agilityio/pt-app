import { Trash2 } from "lucide-react";

import { ICON_BUTTON } from "@/constants/styles";
import {
  describeDeleteLabel,
  describeRepsLabel,
  describeWeightLabel,
  SET_LOGGER_COPY,
} from "@/features/workouts/constants/set-logger";
import type {
  SetRowDraft,
  SetRowField,
} from "@/features/workouts/utils/set-rows";

interface SetRowProps {
  index: number;
  row: SetRowDraft;
  // The PT's target, e.g. "8-12", shown as the reps placeholder (E2).
  targetReps: string;
  canRemove: boolean;
  isDisabled: boolean;
  onChange: (id: number, field: SetRowField, value: string) => void;
  onRemove: (id: number) => void;
}

// `INPUT` with less padding and centred text, so two inputs and the delete
// button fit a 390 px phone without horizontal scroll.
const SET_INPUT =
  "block min-h-12 w-full min-w-0 rounded-xl border border-line bg-surface px-2 text-center text-base text-fg tabular-nums placeholder:text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30 disabled:opacity-60";

export const SetRow = ({
  index,
  row,
  targetReps,
  canRemove,
  isDisabled,
  onChange,
  onRemove,
}: SetRowProps) => {
  const setNumber = index + 1;

  return (
    <li className="grid grid-cols-[1.75rem_1fr_1fr_2.75rem] items-center gap-2">
      <span className="text-center text-sm font-semibold text-muted tabular-nums">
        {setNumber}
      </span>
      {/* Text, not number: Vietnamese keyboards type "42,5", which a number
          input reports as empty. The 0.5 kg step is checked on save. */}
      <input
        type="text"
        inputMode="decimal"
        autoComplete="off"
        enterKeyHint="next"
        value={row.weight}
        onChange={(event) => onChange(row.id, "weight", event.target.value)}
        placeholder={SET_LOGGER_COPY.WEIGHT_PLACEHOLDER}
        aria-label={describeWeightLabel(setNumber)}
        disabled={isDisabled}
        className={SET_INPUT}
      />
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="off"
        enterKeyHint="done"
        value={row.reps}
        onChange={(event) => onChange(row.id, "reps", event.target.value)}
        placeholder={targetReps.trim() || SET_LOGGER_COPY.REPS_UNIT}
        aria-label={describeRepsLabel(setNumber)}
        disabled={isDisabled}
        className={SET_INPUT}
      />
      <button
        type="button"
        onClick={() => onRemove(row.id)}
        disabled={!canRemove || isDisabled}
        aria-label={describeDeleteLabel(setNumber)}
        className={ICON_BUTTON}
      >
        <Trash2 className="size-5" aria-hidden />
      </button>
    </li>
  );
};
