import { describe, expect, it } from "vitest";

import { GROUP_MEMBER_CAP } from "@/features/chat-groups/constants/limits";
import type {
  GroupActor,
  GroupSession,
} from "@/features/chat-groups/types/group";
import {
  addMembersSchema,
  addScopeOutcome,
  buildGroupActor,
  canFitMembers,
  canManageGroup,
  createGroupSchema,
  groupNameSchema,
  groupSendBlockReason,
  isManagerActor,
  memberCapRoom,
  parseGroupId,
  sendGroupSchema,
} from "@/features/chat-groups/utils/group-rules";

const group = { createdByKey: "admin:2", dissolvedAt: null as Date | null };
const active = { leftAt: null };
const superAdmin: GroupSession = { kind: "admin", id: 1, role: "super_admin" };
const creatorPt: GroupSession = { kind: "admin", id: 2, role: "pt" };
const otherPt: GroupSession = { kind: "admin", id: 3, role: "pt" };
const trainee: GroupSession = { kind: "user", id: 9 };

const actorOf = (
  session: GroupSession,
  member: { leftAt: Date | null } | null,
) => buildGroupActor({ session, group, member })!;

describe("buildGroupActor", () => {
  it("makes a super admin an implicit member with no member row", () => {
    expect(actorOf(superAdmin, null)).toMatchObject({
      key: "admin:1",
      role: "super_admin",
      isMember: true,
      canManage: true,
      isManager: true,
    });
  });

  it("keeps a super admin in a dissolved group (read-only access)", () => {
    expect(
      buildGroupActor({
        session: superAdmin,
        group: { ...group, dissolvedAt: new Date() },
        member: null,
      }),
    ).not.toBeNull();
  });

  it("gives the creator PT manage rights and a PT member only manager status", () => {
    expect(actorOf(creatorPt, active)).toMatchObject({
      role: "pt",
      canManage: true,
      isManager: true,
    });
    expect(actorOf(otherPt, active)).toMatchObject({
      canManage: false,
      isManager: true,
    });
  });

  it("makes a trainee a plain member", () => {
    expect(actorOf(trainee, active)).toMatchObject({
      key: "user:9",
      role: "trainee",
      canManage: false,
      isManager: false,
    });
  });

  it("answers nothing for a non-member, a left member and a dissolved group", () => {
    expect(
      buildGroupActor({ session: trainee, group, member: null }),
    ).toBeNull();
    expect(
      buildGroupActor({
        session: trainee,
        group,
        member: { leftAt: new Date() },
      }),
    ).toBeNull();
    expect(
      buildGroupActor({
        session: creatorPt,
        group: { ...group, dissolvedAt: new Date() },
        member: active,
      }),
    ).toBeNull();
  });

  it("lets only super admins manage once the creator PT account is gone", () => {
    const orphaned = { ...group, createdByKey: "admin:404" };

    expect(
      buildGroupActor({ session: creatorPt, group: orphaned, member: active })
        ?.canManage,
    ).toBe(false);
    expect(
      buildGroupActor({ session: superAdmin, group: orphaned, member: null })
        ?.canManage,
    ).toBe(true);
  });

  it("exposes the permission helpers", () => {
    expect(canManageGroup(actorOf(creatorPt, active))).toBe(true);
    expect(canManageGroup(actorOf(trainee, active))).toBe(false);
    expect(isManagerActor(actorOf(otherPt, active))).toBe(true);
    expect(isManagerActor(actorOf(trainee, active))).toBe(false);
  });
});

describe("groupSendBlockReason", () => {
  const base = (actor: GroupActor) => ({
    actor,
    dissolved: false,
    managersOnly: false,
    chatEnabled: true,
    restricted: false,
  });

  it("lets everyone send by default", () => {
    expect(groupSendBlockReason(base(actorOf(trainee, active)))).toBeNull();
  });

  it("blocks a trainee under managers-only but not a PT or super admin", () => {
    const on = { managersOnly: true };

    expect(
      groupSendBlockReason({ ...base(actorOf(trainee, active)), ...on }),
    ).toBe("managers_only");
    expect(
      groupSendBlockReason({ ...base(actorOf(otherPt, active)), ...on }),
    ).toBeNull();
    expect(
      groupSendBlockReason({ ...base(actorOf(superAdmin, null)), ...on }),
    ).toBeNull();
  });

  it("can ignore managers-only for reactions and edits", () => {
    expect(
      groupSendBlockReason({
        ...base(actorOf(trainee, active)),
        managersOnly: true,
        ignoreManagersOnly: true,
      }),
    ).toBeNull();
  });

  it("blocks a trainee whose chat is off or who is restricted", () => {
    const actor = actorOf(trainee, active);

    expect(groupSendBlockReason({ ...base(actor), chatEnabled: false })).toBe(
      "chat_off",
    );
    expect(groupSendBlockReason({ ...base(actor), restricted: true })).toBe(
      "restricted",
    );
  });

  it("does not apply the trainee chat switch or restriction to admins", () => {
    expect(
      groupSendBlockReason({
        ...base(actorOf(creatorPt, active)),
        chatEnabled: false,
        restricted: true,
      }),
    ).toBeNull();
  });

  it("blocks a dissolved group for everyone and a non-member", () => {
    expect(
      groupSendBlockReason({
        ...base(actorOf(superAdmin, null)),
        dissolved: true,
      }),
    ).toBe("dissolved");
    expect(
      groupSendBlockReason({
        ...base({ ...actorOf(trainee, active), isMember: false }),
      }),
    ).toBe("left");
  });
});

describe("addScopeOutcome", () => {
  it("lets a super admin add any trainee and any PT", () => {
    const actor = actorOf(superAdmin, null);

    expect(addScopeOutcome(actor, { kind: "user" })).toBeNull();
    expect(addScopeOutcome(actor, { kind: "admin", isPt: true })).toBeNull();
  });

  it("lets a PT add only accessible (own, not hidden) trainees", () => {
    const actor = actorOf(creatorPt, active);

    expect(
      addScopeOutcome(actor, { kind: "user", accessible: true }),
    ).toBeNull();
    expect(addScopeOutcome(actor, { kind: "user", accessible: false })).toBe(
      "out_of_scope",
    );
    expect(addScopeOutcome(actor, { kind: "user" })).toBe("out_of_scope");
  });

  it("never lets a PT add another PT, and refuses a super admin target", () => {
    expect(
      addScopeOutcome(actorOf(creatorPt, active), {
        kind: "admin",
        isPt: true,
      }),
    ).toBe("out_of_scope");
    expect(
      addScopeOutcome(actorOf(superAdmin, null), {
        kind: "admin",
        isPt: false,
      }),
    ).toBe("not_trainee");
  });

  it("never lets a trainee add anyone", () => {
    expect(
      addScopeOutcome(actorOf(trainee, active), {
        kind: "user",
        accessible: true,
      }),
    ).toBe("out_of_scope");
  });
});

describe("member cap", () => {
  it("allows 49 to 50 and refuses 50 to 51", () => {
    expect(GROUP_MEMBER_CAP).toBe(50);
    expect(canFitMembers(49, 1)).toBe(true);
    expect(canFitMembers(50, 1)).toBe(false);
    expect(canFitMembers(0, 50)).toBe(true);
    expect(canFitMembers(0, 51)).toBe(false);
  });

  it("reports the room left and never a negative one", () => {
    expect(memberCapRoom(10)).toBe(40);
    expect(memberCapRoom(70)).toBe(0);
  });
});

describe("input schemas", () => {
  it("trims and collapses the name and counts characters", () => {
    expect(groupNameSchema.parse("  Lớp   sáng  ")).toBe("Lớp sáng");
    expect(groupNameSchema.safeParse("   ").success).toBe(false);
    expect(groupNameSchema.safeParse("a".repeat(60)).success).toBe(true);
    expect(groupNameSchema.safeParse("a".repeat(61)).success).toBe(false);
    expect(groupNameSchema.safeParse("😀".repeat(60)).success).toBe(true);
    expect(groupNameSchema.safeParse("bad\u0000name").success).toBe(false);
  });

  it("defaults the member lists, keeps odd ids for a per-id result and caps the list", () => {
    expect(createGroupSchema.parse({ name: "A" })).toEqual({
      name: "A",
      userIds: [],
      ptIds: [],
    });
    expect(
      addMembersSchema.parse({ groupId: 1, userIds: [1, -2, "x"] }).userIds,
    ).toEqual([1, -2, "x"]);
    expect(
      addMembersSchema.safeParse({ groupId: 0, userIds: [1] }).success,
    ).toBe(false);
    expect(
      addMembersSchema.safeParse({
        groupId: 1,
        userIds: Array.from({ length: 101 }, (_, i) => i + 1),
      }).success,
    ).toBe(false);
  });

  it("parses group ids strictly", () => {
    expect(parseGroupId("12")).toBe(12);
    expect(parseGroupId("0")).toBeNull();
    expect(parseGroupId("-1")).toBeNull();
    expect(parseGroupId("1.5")).toBeNull();
    expect(parseGroupId("abc")).toBeNull();
    expect(parseGroupId("")).toBeNull();
    expect(parseGroupId(undefined)).toBeNull();
  });

  it("needs text, a photo or exactly one sticker to send", () => {
    const clientId = crypto.randomUUID();

    expect(sendGroupSchema.safeParse({ groupId: 1, clientId }).success).toBe(
      false,
    );
    expect(
      sendGroupSchema.safeParse({ groupId: 1, clientId, body: "hi" }).success,
    ).toBe(true);
    expect(
      sendGroupSchema.safeParse({ groupId: 1, clientId, photoId: 3 }).success,
    ).toBe(true);
    expect(
      sendGroupSchema.safeParse({ groupId: 0, clientId, body: "hi" }).success,
    ).toBe(false);
  });
});
