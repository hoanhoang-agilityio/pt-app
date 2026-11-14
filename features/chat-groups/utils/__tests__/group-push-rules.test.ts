import { describe, expect, it } from "vitest";

import { groupNotificationTags } from "@/features/chat/utils/clear-notifications";
import {
  buildGroupPushPayload,
  groupPushTag,
  groupPushUrl,
} from "@/features/chat-groups/utils/group-push-rules";

describe("group push deep links", () => {
  it("opens the trainee thread for trainees and the admin thread for admins", () => {
    expect(groupPushUrl("user", 12)).toBe("/messages/groups/12");
    expect(groupPushUrl("admin", 12)).toBe("/admin/messages/groups/12");
  });

  it("puts the right link and one tag per group in the payload", () => {
    const base = {
      groupId: 12,
      groupName: "Lớp sáng",
      senderName: "An",
      body: "chào cả nhóm",
    };
    const forUser = buildGroupPushPayload({ ...base, recipient: "user" });
    const forAdmin = buildGroupPushPayload({ ...base, recipient: "admin" });

    expect(forUser).toMatchObject({
      title: "Lớp sáng",
      url: "/messages/groups/12",
      tag: "chat-group-12",
    });
    expect(forUser.body).toBe("An: chào cả nhóm");
    expect(forAdmin.url).toBe("/admin/messages/groups/12");
    expect(forAdmin.tag).toBe(forUser.tag);
  });

  it("opening a group thread clears exactly the tag its push carries", () => {
    expect(groupNotificationTags(12)).toEqual([groupPushTag(12)]);
    expect(
      buildGroupPushPayload({
        recipient: "user",
        groupId: 12,
        groupName: "x",
        senderName: "",
      }).tag,
    ).toBe(groupNotificationTags(12)[0]);
  });
});
