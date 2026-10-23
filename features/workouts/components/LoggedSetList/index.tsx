import { SET_LOGGER_COPY } from "@/features/workouts/constants/set-logger";
import { formatSet } from "@/features/workouts/utils/set-logger";
import type { LoggedSet } from "@/features/workouts/utils/sets";

interface LoggedSetListProps {
  sets: LoggedSet[];
}

// Read-only sets (Q13): the admin preview (E5) shows the empty fallback; the
// member page (F1) only renders it when sets exist.
export const LoggedSetList = ({ sets }: LoggedSetListProps) => (
  <p className="border-t border-line px-4 py-3 text-sm text-muted">
    {sets.length > 0 ? (
      <>
        <span className="font-medium text-fg">
          {SET_LOGGER_COPY.LOGGED_PREFIX}
        </span>{" "}
        {sets.map(formatSet).join(" · ")}
      </>
    ) : (
      SET_LOGGER_COPY.NOTHING_LOGGED
    )}
  </p>
);
