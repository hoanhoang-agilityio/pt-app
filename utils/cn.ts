import clsx, { type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// Design tokens from app/globals.css @theme. Without them tailwind-merge would
// read `text-body` as a color and drop a sibling `text-fg`.
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [
        {
          text: [
            "nano",
            "micro",
            "caption",
            "small",
            "compact",
            "body",
            "lead",
          ],
        },
      ],
      rounded: [
        {
          rounded: ["control", "card", "panel", "sheet", "dock", "dock-item"],
        },
      ],
      shadow: [{ shadow: ["pop", "dock"] }],
    },
  },
});

// clsx + tailwind-merge: later classes win over earlier conflicting ones
// (e.g. a caller's `pr-10` replaces a component's `pr-4`), regardless of the
// order Tailwind emits them in CSS.
export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));
