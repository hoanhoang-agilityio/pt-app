"use client";

import { Reply } from "lucide-react";

interface ReplyHoverButtonProps {
  label: string;
  onClick: () => void;
}

// Desktop only: a small reply button beside a bubble, shown while the row is
// hovered or has focus (inside a SwipeReplyRow, which is the `group/row`).
// Touch screens have no hover, so it stays out of the layout there.
export const ReplyHoverButton = ({ label, onClick }: ReplyHoverButtonProps) => (
  <button
    type="button"
    onClick={onClick}
    aria-label={label}
    className="hidden size-7 shrink-0 items-center justify-center self-center rounded-full text-muted opacity-0 transition-opacity hover:bg-fg/5 hover:text-fg focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:outline-none [@media(hover:hover)]:inline-flex [@media(hover:hover)]:group-focus-within/row:opacity-100 [@media(hover:hover)]:group-hover/row:opacity-100"
  >
    <Reply className="size-4" aria-hidden />
  </button>
);
