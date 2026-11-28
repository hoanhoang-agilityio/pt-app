import clsx from "clsx";
import { Reply } from "lucide-react";
import type { ReactNode } from "react";

import { SWIPE_ROOT_ATTRIBUTE } from "@/features/chat/hooks/use-bubble-gesture";

interface SwipeReplyRowProps {
  // False = a plain row (no icon, no transform).
  isSwipeable: boolean;
  className?: string;
  children: ReactNode;
}

const ROOT_ATTRIBUTE = { [SWIPE_ROOT_ATTRIBUTE]: "" };

// The row of one bubble. While the finger swipes right, use-bubble-gesture
// writes --swipe-x / --swipe-p and data-armed / data-swiping on this root: the
// row follows --swipe-x, the reply icon behind its left side fades and grows
// with --swipe-p and fills with the accent once releasing would reply. With
// the variables gone the row springs back (200 ms, none when the person
// prefers reduced motion). `group/row` also drives the desktop reply button.
export const SwipeReplyRow = ({
  isSwipeable,
  className,
  children,
}: SwipeReplyRowProps) => (
  <div {...ROOT_ATTRIBUTE} className="group/row relative w-full">
    {isSwipeable && (
      <span
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-2 flex size-8 items-center justify-center rounded-full bg-line text-muted group-data-[armed]/row:bg-accent group-data-[armed]/row:text-accent-fg"
        style={{
          opacity: "var(--swipe-p, 0)",
          transform:
            "translateY(-50%) scale(calc(0.5 + 0.5 * var(--swipe-p, 0)))",
        }}
      >
        <Reply className="size-4" />
      </span>
    )}
    <div
      className={clsx(
        isSwipeable &&
          "transition-transform duration-200 ease-out group-data-[swiping]/row:transition-none motion-reduce:transition-none",
        className,
      )}
      style={
        isSwipeable
          ? { transform: "translateX(var(--swipe-x, 0px))" }
          : undefined
      }
    >
      {children}
    </div>
  </div>
);
