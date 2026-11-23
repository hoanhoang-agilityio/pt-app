import { describe, expect, it } from "vitest";

import { cn } from "@/utils/cn";

describe("cn", () => {
  it("lets a later padding class override an earlier one", () => {
    expect(cn("px-4 pr-11", "pr-24")).toBe("px-4 pr-24");
    expect(cn("pl-4 pr-4", "pl-3 pr-10")).toBe("pl-3 pr-10");
  });

  it("lets a later min-height override the size default", () => {
    expect(cn("min-h-12", "min-h-11")).toBe("min-h-11");
  });

  it("keeps theme colour and font-size utilities apart", () => {
    expect(cn("text-base text-fg", "text-sm")).toBe("text-fg text-sm");
  });

  it("treats design-token sizes, radii and shadows as their own groups", () => {
    expect(cn("text-body text-fg")).toBe("text-body text-fg");
    expect(cn("text-body", "text-caption")).toBe("text-caption");
    expect(cn("rounded-card", "rounded-control")).toBe("rounded-control");
    expect(cn("shadow-pop", "shadow-dock")).toBe("shadow-dock");
  });

  it("drops falsy values like clsx", () => {
    expect(cn("a", false, undefined, "b")).toBe("a b");
  });
});
