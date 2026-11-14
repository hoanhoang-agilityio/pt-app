import { describe, expect, it } from "vitest";

import { groupRoutes } from "@/features/chat-groups/utils/group-adapter-urls";

describe("groupRoutes", () => {
  it("asks the admin view with ?as=admin on every route", () => {
    const routes = groupRoutes(12, "admin");

    expect(routes.messages).toBe("/api/chat/groups/12/messages?as=admin");
    expect(routes.edits(5)).toBe(
      "/api/chat/groups/12/messages/5/edits?as=admin",
    );
    expect(routes.seenBy(5)).toBe(
      "/api/chat/groups/12/messages/5/seen?as=admin",
    );
    expect(routes.members).toBe("/api/chat/groups/12/members?as=admin");
    expect(routes.photos).toBe("/api/chat/groups/12/photos?as=admin");
  });

  it("leaves the trainee routes without a query", () => {
    const routes = groupRoutes(12, "user");

    expect(routes.messages).toBe("/api/chat/groups/12/messages");
    expect(routes.edits(5)).toBe("/api/chat/groups/12/messages/5/edits");
    expect(routes.photos).toBe("/api/chat/groups/12/photos");
  });
});
