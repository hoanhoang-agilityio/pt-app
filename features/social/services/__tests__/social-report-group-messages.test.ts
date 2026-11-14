import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createTestDb, type TestDb } from "@/db/__tests__/create-test-db";
import {
  chatGroupMembers,
  chatGroupMessages,
  chatGroups,
  socialReports,
} from "@/db/schema";
import {
  seedAdmin,
  seedGroup,
  seedMessage,
  seedUser,
} from "@/features/chat-groups/services/__tests__/seed";
import type { SocialActor } from "@/features/social/types/social";
import { reportSchema } from "@/features/social/utils/friend-rules";

const state = vi.hoisted(() => ({
  db: null as unknown,
  pending: [] as Promise<unknown>[],
}));

vi.mock("server-only", () => ({}));
vi.mock("web-push", () => ({ default: { sendNotification: vi.fn() } }));
vi.mock("next/server", () => ({
  after: (task: () => Promise<unknown>) => {
    state.pending.push(task());
  },
}));
vi.mock("@/services/logger", () => ({
  logServerError: vi.fn(() => ({ code: "UNKNOWN" })),
}));
vi.mock("@/services/admin-lock", () => ({
  canSeeHiddenUsers: vi.fn(async () => false),
}));
vi.mock("@/db", () => ({
  db: new Proxy(
    {},
    { get: (_target, property) => Reflect.get(state.db as object, property) },
  ),
}));

const reports = await import("@/features/social/services/report-mutations");
const reportQueries = await import("@/features/social/services/report-queries");

let db: TestDb;
let superId: number;
let ptId: number;
let outsiderPtId: number;
let an: number;
let binh: number;
let outsider: number;
let groupId: number;
let fromBinh: number;
let fromPt: number;

const asUser = (id: number) => ({ kind: "user", id }) satisfies SocialActor;
const asAdmin = (id: number, role: "super_admin" | "pt") =>
  ({ kind: "admin", id, role }) satisfies SocialActor;

const report = (actor: SocialActor, messageId: number) =>
  reports.createReport(actor, {
    targetKind: "group_message",
    targetId: messageId,
    reasonCode: "harassment",
    reason: "  rude  ",
  });

const rows = () => db.select().from(socialReports);
const stored = async (id: number) =>
  (
    await db
      .select()
      .from(chatGroupMessages)
      .where(eq(chatGroupMessages.id, id))
  )[0];

const notFound = { ok: false, error: "not_found" } as const;

beforeEach(async () => {
  state.pending = [];
  db = await createTestDb();
  state.db = db;
  superId = await seedAdmin(db, "Boss", "super_admin");
  ptId = await seedAdmin(db, "Coach", "pt");
  outsiderPtId = await seedAdmin(db, "Elsewhere", "pt");
  an = await seedUser(db, "An", { ptAdminId: ptId });
  binh = await seedUser(db, "Binh", { ptAdminId: ptId });
  outsider = await seedUser(db, "Cuong");
  groupId = await seedGroup(db, {
    createdByKey: `admin:${ptId}`,
    members: [`admin:${ptId}`, `user:${an}`, `user:${binh}`],
  });
  fromBinh = await seedMessage(db, groupId, `user:${binh}`, "rude text");
  fromPt = await seedMessage(db, groupId, `admin:${ptId}`, "hello team");
});

describe("who may report a group message", () => {
  it("a trainee member reports another member and the note is trimmed", async () => {
    expect(await report(asUser(an), fromBinh)).toEqual({ ok: true });
    expect(await report(asUser(an), fromPt)).toEqual({ ok: true });
    expect(await rows()).toMatchObject([
      {
        reporterKey: `user:${an}`,
        targetKind: "group_message",
        targetId: fromBinh,
        reason: "rude",
        reasonCode: "harassment",
        status: "open",
      },
      { targetKind: "group_message", targetId: fromPt },
    ]);
  });

  it("a PT member reports a trainee's message", async () => {
    expect(await report(asAdmin(ptId, "pt"), fromBinh)).toEqual({ ok: true });
    expect(await rows()).toHaveLength(1);
  });

  it("keeps one open report per reporter and message", async () => {
    await report(asUser(an), fromBinh);
    await report(asUser(an), fromBinh);

    expect(await rows()).toHaveLength(1);
  });

  it("refuses your own message", async () => {
    expect(await report(asUser(binh), fromBinh)).toEqual(notFound);
    expect(await report(asAdmin(ptId, "pt"), fromPt)).toEqual(notFound);
    expect(await rows()).toHaveLength(0);
  });

  it("a super admin never reports", async () => {
    expect(await report(asAdmin(superId, "super_admin"), fromBinh)).toEqual(
      notFound,
    );
    expect(await rows()).toHaveLength(0);
  });

  it("refuses a trainee or PT outside the group", async () => {
    expect(await report(asUser(outsider), fromBinh)).toEqual(notFound);
    expect(await report(asAdmin(outsiderPtId, "pt"), fromBinh)).toEqual(
      notFound,
    );
    expect(await rows()).toHaveLength(0);
  });

  it("refuses a member who left", async () => {
    await db
      .update(chatGroupMembers)
      .set({ leftAt: new Date() })
      .where(
        and(
          eq(chatGroupMembers.groupId, groupId),
          eq(chatGroupMembers.memberKey, `user:${an}`),
        ),
      );

    expect(await report(asUser(an), fromBinh)).toEqual(notFound);
  });

  it("refuses a dissolved group", async () => {
    await db
      .update(chatGroups)
      .set({ dissolvedAt: new Date() })
      .where(eq(chatGroups.id, groupId));

    expect(await report(asUser(an), fromBinh)).toEqual(notFound);
  });

  it("refuses unsent, hidden, system, alert and missing messages", async () => {
    const unsent = await seedMessage(db, groupId, `user:${binh}`, "", {
      deletedAt: new Date(),
    });
    const hidden = await seedMessage(db, groupId, `user:${binh}`, "x", {
      hiddenAt: new Date(),
      hiddenByKey: `admin:${superId}`,
    });
    const system = await seedMessage(db, groupId, null, "");
    const alert = await seedMessage(db, groupId, null, "", {
      audience: "super_admin",
    });

    for (const id of [unsent, hidden, system, alert, 99999]) {
      expect(await report(asUser(an), id)).toEqual(notFound);
    }
    expect(await rows()).toHaveLength(0);
  });

  it("the report schema knows the group_message kind and nothing else new", async () => {
        expect(
      reportSchema.safeParse({
        targetKind: "group_message",
        targetId: 1,
        reasonCode: "spam",
      }).success,
    ).toBe(true);
    expect(
      reportSchema.safeParse({
        targetKind: "channel_message",
        targetId: 1,
        reasonCode: "spam",
      }).success,
    ).toBe(false);
  });
});

describe("the reports queue and its resolutions", () => {
  it("lists a group message report with its group, sender and link", async () => {
    await report(asUser(an), fromBinh);

    const [row] = await reportQueries.listOpenReports();

    expect(row).toMatchObject({
      targetKind: "group_message",
      targetId: fromBinh,
      reporterName: "An",
      preview: "rude text",
      targetName: "Binh",
      href: `/admin/messages/groups/${groupId}`,
      group: { id: groupId, name: "Lớp sáng" },
      message: {
        senderRole: "user",
        senderName: "Binh",
        traineeId: binh,
        kind: "text",
      },
    });
  });

  it("a PT sender cannot be blocked from the queue (no trainee id)", async () => {
    await report(asUser(an), fromPt);

    const [row] = await reportQueries.listOpenReports();

    expect(row.message).toMatchObject({
      senderRole: "admin",
      senderName: "Coach",
      traineeId: 0,
    });
  });

  it("a report whose message was unsent has nothing to show", async () => {
    await report(asUser(an), fromBinh);
    await db
      .update(chatGroupMessages)
      .set({ deletedAt: new Date() })
      .where(eq(chatGroupMessages.id, fromBinh));

    const [row] = await reportQueries.listOpenReports();

    expect(row).toMatchObject({ preview: null, href: null, group: null });
    expect(row.message).toBeNull();
  });

  it("hide hides the group message for everybody and closes every open report on it", async () => {
    await report(asUser(an), fromBinh);
    await report(asAdmin(ptId, "pt"), fromBinh);

    expect(
      await reports.resolveReport(
        asAdmin(superId, "super_admin"),
        (await rows())[0].id,
        "hidden",
      ),
    ).toEqual({ ok: true });

    const message = await stored(fromBinh);

    expect(message.hiddenByKey).toBe(`admin:${superId}`);
    expect(message.hiddenAt).not.toBeNull();
    expect(message.body).toBe("rude text");
    expect(message.updatedAt).not.toBeNull();
    expect((await rows()).map((row) => [row.status, row.resolution])).toEqual([
      ["resolved", "hidden"],
      ["resolved", "hidden"],
    ]);
  });

  it("hide works in a dissolved group and when already hidden", async () => {
    await report(asUser(an), fromBinh);
    await db
      .update(chatGroups)
      .set({ dissolvedAt: new Date() })
      .where(eq(chatGroups.id, groupId));
    await db
      .update(chatGroupMessages)
      .set({ hiddenAt: new Date(2026, 0, 1), hiddenByKey: "admin:99" })
      .where(eq(chatGroupMessages.id, fromBinh));

    expect(
      await reports.resolveReport(
        asAdmin(superId, "super_admin"),
        (await rows())[0].id,
        "hidden",
      ),
    ).toEqual({ ok: true });
    // The first hider stays on the record.
    expect((await stored(fromBinh)).hiddenByKey).toBe("admin:99");
  });

  it("keep leaves the message visible", async () => {
    await report(asUser(an), fromBinh);
    await reports.resolveReport(
      asAdmin(superId, "super_admin"),
      (await rows())[0].id,
      "kept",
    );

    expect((await stored(fromBinh)).hiddenAt).toBeNull();
    expect((await rows())[0]).toMatchObject({
      status: "resolved",
      resolution: "kept",
    });
  });

  it("a group message cannot be deleted, and only a super admin resolves", async () => {
    await report(asUser(an), fromBinh);
    const id = (await rows())[0].id;

    expect(
      await reports.resolveReport(
        asAdmin(superId, "super_admin"),
        id,
        "deleted",
      ),
    ).toEqual({ ok: false, error: "forbidden" });
    expect(
      await reports.resolveReport(asAdmin(ptId, "pt"), id, "hidden"),
    ).toEqual({ ok: false, error: "forbidden" });
    expect((await stored(fromBinh)).hiddenAt).toBeNull();
    expect((await rows())[0].status).toBe("open");
  });
});
