import { describe, expect, it } from "vitest";

import { actionsFor, notificationTarget, parseSearchEmail, reportNeedsReason } from "../social-rules";

describe("parseSearchEmail", () => {
  it("accepts a full address and lower-cases it", () => {
    expect(parseSearchEmail("  An@Example.COM ")).toBe("an@example.com");
  });

  it("rejects prefixes and junk", () => {
    expect(parseSearchEmail("an@")).toBeNull();
    expect(parseSearchEmail("an")).toBeNull();
    expect(parseSearchEmail("")).toBeNull();
  });
});

describe("actionsFor", () => {
  it("offers the right buttons per relationship", () => {
    expect(actionsFor("none")).toEqual(["add"]);
    expect(actionsFor("sent")).toEqual(["cancel"]);
    expect(actionsFor("received")).toEqual(["accept", "decline"]);
    expect(actionsFor("friends")).toEqual(["unfriend"]);
  });
});

describe("reportNeedsReason", () => {
  it("requires a reason for chat messages only", () => {
    expect(reportNeedsReason("message")).toBe(true);
    expect(reportNeedsReason("group_message")).toBe(true);
    expect(reportNeedsReason("post")).toBe(false);
  });
});

describe("notificationTarget", () => {
  it("opens the post, the friends screen or the actor's profile", () => {
    expect(notificationTarget({ kind: "post_comment", postId: 4, actorKey: "user:1" })).toEqual({
      type: "post",
      id: 4,
    });
    expect(notificationTarget({ kind: "friend_request", postId: null, actorKey: "user:1" })).toEqual({
      type: "friends",
    });
    expect(notificationTarget({ kind: "friend_accepted", postId: null, actorKey: "user:1" })).toEqual({
      type: "profile",
      key: "user:1",
    });
  });
});
