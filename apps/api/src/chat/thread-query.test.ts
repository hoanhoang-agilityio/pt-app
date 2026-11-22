import {
  chatSearchQuerySchema,
  chatThreadQuerySchema,
  groupThreadQuerySchema,
  INT4_MAX,
} from "@pt/contracts";
import { describe, expect, it } from "vitest";

// The cursors are compared with integer id columns; a number past int4 would
// reach PostgreSQL and fail there with a 500. The schema (the validation pipe
// of these routes) must refuse it first, which answers 400.
describe("thread cursors stay inside int4", () => {
  const tooBig = String(INT4_MAX + 1);

  it("accepts the largest int4 as the poll cursor", () => {
    expect(
      chatThreadQuerySchema.safeParse({ after: String(INT4_MAX) }).success,
    ).toBe(true);
    expect(
      groupThreadQuerySchema.safeParse({ after: String(INT4_MAX) }).success,
    ).toBe(true);
  });

  it.each(["after", "before", "around"])("rejects %s past int4", (key) => {
    expect(chatThreadQuerySchema.safeParse({ [key]: tooBig }).success).toBe(
      false,
    );
  });

  it("rejects the group and search cursors past int4", () => {
    expect(groupThreadQuerySchema.safeParse({ after: tooBig }).success).toBe(
      false,
    );
    expect(
      chatSearchQuerySchema.safeParse({ q: "squat", before: tooBig }).success,
    ).toBe(false);
  });
});
