"use client";

import * as Popover from "@radix-ui/react-popover";
import { SlidersHorizontal } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { BottomSheet } from "@/components/common/BottomSheet";
import { ExerciseFilterPanel } from "@/features/exercise-library/components/ExerciseFilterPanel";
import type {
  ExerciseFilters,
  FilterGroup,
} from "@/features/exercise-library/constants/filters";
import { useMediaQuery } from "@/features/exercise-library/hooks/use-media-query";
import { countFilters } from "@/features/exercise-library/utils/exercise-filters";

interface ExerciseFilterButtonProps {
  filters: ExerciseFilters;
  onToggle: (group: FilterGroup, key: string) => void;
  onClear: () => void;
  // "sheet" keeps the bottom sheet on wide screens too. Used inside another
  // sheet: its dialog traps focus and dismisses on outside presses, which
  // would fight a popover portalled outside of it.
  placement?: "auto" | "sheet";
  hiddenGroups?: readonly FilterGroup[];
}

// sm in Tailwind: a popover from here up, a bottom sheet below.
const DESKTOP_QUERY = "(min-width: 640px)";

// One "Lọc" button with a count badge. It opens the filter box: a popover on
// a wide screen, a bottom sheet on a phone.
export const ExerciseFilterButton = ({
  filters,
  onToggle,
  onClear,
  placement = "auto",
  hiddenGroups,
}: ExerciseFilterButtonProps) => {
  const t = useTranslations("exerciseLibrary.filter");
  const isDesktop = useMediaQuery(DESKTOP_QUERY) && placement === "auto";
  // The layout the box was opened in. Popover and sheet are different boxes,
  // so a resize or rotation across the breakpoint closes it.
  const [openIn, setOpenIn] = useState<boolean | null>(null);
  const isOpen = openIn === isDesktop;
  const setIsOpen = (open: boolean) => setOpenIn(open ? isDesktop : null);
  const count = countFilters(filters);

  const trigger = (
    <button
      type="button"
      aria-haspopup="dialog"
      aria-expanded={isOpen}
      aria-label={count > 0 ? t("buttonCount", { count }) : t("button")}
      onClick={isDesktop ? undefined : () => setIsOpen(true)}
      className="relative inline-flex min-h-12 shrink-0 items-center gap-2 rounded-xl border border-line bg-surface px-4 text-base font-semibold text-fg transition active:bg-line/40 focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:outline-none"
    >
      <SlidersHorizontal className="size-5" aria-hidden />
      {t("button")}
      {count > 0 && (
        <span
          aria-hidden
          className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-accent px-1.5 text-xs font-semibold text-accent-fg tabular-nums"
        >
          {count}
        </span>
      )}
    </button>
  );

  if (isDesktop) {
    return (
      <Popover.Root open={isOpen} onOpenChange={setIsOpen}>
        <Popover.Trigger asChild>{trigger}</Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            align="end"
            sideOffset={8}
            collisionPadding={16}
            aria-label={t("title")}
            className="z-[60] flex w-[min(24rem,calc(100vw-2rem))] max-h-[min(32rem,var(--radix-popover-content-available-height))] flex-col rounded-2xl border border-line bg-bg p-3 shadow-lg outline-none"
          >
            <ExerciseFilterPanel
              variant="popover"
              hiddenGroups={hiddenGroups}
              filters={filters}
              onToggle={onToggle}
              onClear={onClear}
            />
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    );
  }
  return (
    <>
      {trigger}
      <BottomSheet
        isOpen={isOpen}
        onOpenChange={setIsOpen}
        title={t("title")}
        isTall
        // The search field is the first control; keep the keyboard closed.
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <ExerciseFilterPanel
          variant="sheet"
          hiddenGroups={hiddenGroups}
          filters={filters}
          onToggle={onToggle}
          onClear={onClear}
          onDone={() => setIsOpen(false)}
        />
      </BottomSheet>
    </>
  );
};
