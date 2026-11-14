import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createTestDb, type TestDb } from "@/db/__tests__/create-test-db";
import {
  chatGroupMembers,
  chatGroupMessages,
  chatGroupPhotos,
  chatGroupReactions,
  chatGroups,
  contactAliases,
} from "@/db/schema";
import {
  seedAdmin,
  seedGroup,
  seedMessage,
  seedUser,
} from "@/features/chat-groups/services/__tests__/seed";
import type { GroupSession } from "@/features/chat-groups/types/group";
import {
  countUnreadFor,
  type UnreadCandidate,
} from "@/features/chat-groups/utils/group-unread";

const state = vi.hoisted(() => ({ db: null as unknown }));

vi.mock("server-only", () => ({}));
vi.mock("@/db", () => ({
  db: new Proxy(
    {},
    { get: (_target, property) => Reflect.get(state.db as object, property) },
  ),
}));

const access = await import("@/features/chat-groups/services/group-access");
const queries = await import("@/features/chat-groups/services/group-queries");

let db: TestDb;
let superId: number;
let ptId: number;
let anId: number;
let binhId: number;
let groupId: number;

const asSuper = () =>
  access.sessionOfAdmin({ id: superId, role: "super_admin" });
const asPt = () => access.sessionOfAdmin({ id: ptId, role: "pt" });
const asAn = () => access.sessionOfUser({ id: anId });
const asBinh = () => access.sessionOfUser({ id: binhId });
const actorOf = async (session: GroupSession) =>
  (await access.loadGroupActor(groupId, session))!.actor;

beforeEach(async () => {
  db = await createTestDb();
  state.db = db;
  // Created long ago, so old messages count for this super admin.
  superId = await seedAdmin(db, "Boss", "super_admin", new Date(1000));
  ptId = await seedAdmin(db, "Coach", "pt");
  anId = await seedUser(db, "An");
  binhId = await seedUser(db, "Binh");
  groupId = await seedGroup(db, {
    createdByKey: `admin:${ptId}`,
    members: [`admin:${ptId}`, `user:${anId}`, `user:${binhId}`],
  });
});

const setCursor = (key: string, lastReadMessageId: number) =>
  db
    .update(chatGroupMembers)
    .set({ lastReadMessageId })
    .where(eq(chatGroupMembers.memberKey, key));

describe("the thread and the alert audience", () => {
  it("hides super-admin-only lines from trainees and PTs, and shows them to a super admin", async () => {
    const visible = await seedMessage(db, groupId, `user:${anId}`, "hi");
    const alert = await seedMessage(db, groupId, null, "", {
      audience: "super_admin",
      systemEvent: JSON.stringify({
        type: "pt_changed",
        userId: anId,
        fromPtId: null,
        toPtId: ptId,
        resolution: null,
      }),
    });
    const ids = async (session: GroupSession) =>
      (
        await queries.listGroupMessages(groupId, await actorOf(session))
      ).messages.map((m) => m.id);

    expect(await ids(asAn())).toEqual([visible]);
    expect(await ids(asPt())).toEqual([visible]);
    expect(await ids(asSuper())).toEqual([visible, alert]);
    expect(
      await queries.findGroupMessageView(groupId, alert, await actorOf(asAn())),
    ).toBeNull();
    expect(
      (await queries.listGroupChanges(groupId, await actorOf(asPt()), 0, 0))
        .changes,
    ).toEqual([]);
  });

  it("hydrates what the group thread UI needs: photo size, names of system lines, quote state", async () => {
    const [photo] = await db
      .insert(chatGroupPhotos)
      .values({
        groupId,
        uploaderKey: `user:${anId}`,
        mime: "image/webp",
        width: 800,
        height: 600,
        data: Buffer.from("x"),
        size: 1,
        createdAt: new Date(),
      })
      .returning({ id: chatGroupPhotos.id });
    const original = await seedMessage(db, groupId, `user:${binhId}`, "orig");
    const photoMessage = await seedMessage(db, groupId, `user:${anId}`, "", {
      photoId: photo.id,
    });
    const reply = await seedMessage(db, groupId, `user:${anId}`, "re", {
      replyToMessageId: original,
    });
    const line = await seedMessage(db, groupId, null, "", {
      systemEvent: JSON.stringify({
        type: "member_removed",
        actorKey: `admin:${ptId}`,
        memberKey: "user:9999",
      }),
    });
    const actor = await actorOf(asAn());
    const { messages } = await queries.listGroupMessages(groupId, actor);
    const byId = new Map(messages.map((m) => [m.id, m]));

    expect(byId.get(photoMessage)?.photo).toEqual({
      id: photo.id,
      width: 800,
      height: 600,
    });
    expect(byId.get(line)?.eventNames).toEqual({
      [`admin:${ptId}`]: "Coach",
      "user:9999": null,
    });
    expect(byId.get(reply)?.replyTo).toMatchObject({
      id: original,
      senderKey: `user:${binhId}`,
      snippet: "orig",
      unavailable: false,
    });
    await db
      .update(chatGroupMessages)
      .set({ deletedAt: new Date() })
      .where(eq(chatGroupMessages.id, original));
    const after = await queries.findGroupMessageView(groupId, reply, actor);

    expect(after?.replyTo).toMatchObject({ snippet: "", unavailable: true });
  });

  it("pages with before and after, oldest first, and reports hasMore", async () => {
    const ids: number[] = [];

    for (let i = 0; i < 35; i += 1) {
      ids.push(await seedMessage(db, groupId, `user:${anId}`, `m${i}`));
    }
    const actor = await actorOf(asAn());
    const newest = await queries.listGroupMessages(groupId, actor);

    expect(newest.messages.map((m) => m.id)).toEqual(ids.slice(5));
    expect(newest.hasMore).toBe(true);
    const older = await queries.listGroupMessages(groupId, actor, {
      before: ids[5],
    });

    expect(older.messages.map((m) => m.id)).toEqual(ids.slice(0, 5));
    expect(older.hasMore).toBe(false);
    const newer = await queries.listGroupMessages(groupId, actor, {
      after: ids[32],
    });

    expect(newer.messages.map((m) => m.id)).toEqual(ids.slice(33));
  });

  it("names senders with the viewer's nickname first, tags managers and PTs, and marks deleted accounts", async () => {
    await seedMessage(db, groupId, `admin:${superId}`, "from boss");
    await seedMessage(db, groupId, `admin:${ptId}`, "from pt");
    await seedMessage(db, groupId, `user:${binhId}`, "from binh");
    await seedMessage(db, groupId, "user:9999", "from nobody");
    await db.insert(contactAliases).values({
      ownerKey: `user:${anId}`,
      targetKey: `user:${binhId}`,
      alias: "Bạn Bình",
      updatedAt: new Date(),
    });
    const { messages } = await queries.listGroupMessages(
      groupId,
      await actorOf(asAn()),
    );

    expect(
      messages.map((m) => [m.senderName, m.senderTag, m.senderDeleted]),
    ).toEqual([
      ["Boss", "manager", false],
      ["Coach", "pt", false],
      ["Bạn Bình", null, false],
      [null, null, true],
    ]);
    const forBinh = await queries.listGroupMessages(
      groupId,
      await actorOf(asBinh()),
    );

    expect(forBinh.messages[2].senderName).toBe("Binh");
  });

  it("returns changes since a cursor with the audience filter applied", async () => {
    const id = await seedMessage(db, groupId, `user:${anId}`, "old");

    await db
      .update(chatGroupMessages)
      .set({ updatedAt: new Date(5000) })
      .where(eq(chatGroupMessages.id, id));
    const actor = await actorOf(asBinh());

    expect(
      (await queries.listGroupChanges(groupId, actor, 4000, 5000)).changes.map(
        (m) => m.id,
      ),
    ).toEqual([id]);
    expect(
      (await queries.listGroupChanges(groupId, actor, 5000, 5000)).changes,
    ).toEqual([]);
  });

  it("quotes the reply target and blanks it when that message was unsent", async () => {
    const target = await seedMessage(db, groupId, `user:${anId}`, "câu hỏi");
    const reply = await seedMessage(db, groupId, `user:${binhId}`, "trả lời", {
      replyToMessageId: target,
    });
    const actor = await actorOf(asBinh());

    expect(
      (await queries.findGroupMessageView(groupId, reply, actor))?.replyTo,
    ).toEqual({
      id: target,
      senderKey: `user:${anId}`,
      senderName: "An",
      snippet: "câu hỏi",
      unavailable: false,
      isSticker: false,
      isPhoto: false,
    });
    await db
      .update(chatGroupMessages)
      .set({ deletedAt: new Date() })
      .where(eq(chatGroupMessages.id, target));
    expect(
      (await queries.findGroupMessageView(groupId, reply, actor))?.replyTo
        ?.snippet,
    ).toBe("");
  });

  it("counts reactions per emoji and flags the viewer's own", async () => {
    const id = await seedMessage(db, groupId, `user:${anId}`, "hi");

    await db.insert(chatGroupReactions).values([
      {
        messageId: id,
        reactorKey: `user:${binhId}`,
        emoji: "💪",
        createdAt: new Date(),
      },
      {
        messageId: id,
        reactorKey: `user:${anId}`,
        emoji: "💪",
        createdAt: new Date(),
      },
      {
        messageId: id,
        reactorKey: `admin:${ptId}`,
        emoji: "👍",
        createdAt: new Date(),
      },
    ]);
    const view = await queries.findGroupMessageView(
      groupId,
      id,
      await actorOf(asBinh()),
    );

    expect(view?.reactions).toEqual([
      { emoji: "💪", count: 2, mine: true },
      { emoji: "👍", count: 1, mine: false },
    ]);
  });
});

describe("unread", () => {
  const seedMixed = async () => {
    const own = await seedMessage(db, groupId, `user:${anId}`, "own");
    const counted = await seedMessage(db, groupId, `user:${binhId}`, "counted");
    const system = await seedMessage(db, groupId, null, "");
    const alert = await seedMessage(db, groupId, null, "", {
      audience: "super_admin",
    });
    const hidden = await seedMessage(db, groupId, `user:${binhId}`, "hidden", {
      hiddenAt: new Date(),
      hiddenByKey: `admin:${ptId}`,
    });
    const unsent = await seedMessage(db, groupId, `user:${binhId}`, "", {
      deletedAt: new Date(),
    });
    const second = await seedMessage(db, groupId, `admin:${ptId}`, "second");

    return { own, counted, system, alert, hidden, unsent, second };
  };

  it("excludes own, system, alert, hidden and unsent messages", async () => {
    await seedMixed();
    const unread = await queries.countGroupUnread(asAn());

    expect(unread).toEqual({
      total: 2,
      perGroup: [{ groupId, unread: 2 }],
    });
  });

  it("agrees with the pure predicate on the same rows", async () => {
    await seedMixed();
    const rows = await db.select().from(chatGroupMessages);
    const candidates: UnreadCandidate[] = rows.map((row) => ({
      id: row.id,
      kind: row.kind,
      senderKey: row.senderKey,
      audience: row.audience,
      deletedAt: row.deletedAt,
      hiddenAt: row.hiddenAt,
      createdAt: row.createdAt,
    }));

    for (const [session, key] of [
      [asAn(), `user:${anId}`],
      [asBinh(), `user:${binhId}`],
      [asPt(), `admin:${ptId}`],
    ] as const) {
      expect((await queries.countGroupUnread(session)).total).toBe(
        countUnreadFor(candidates, { key, lastReadMessageId: 0 }),
      );
    }
  });

  it("follows the read cursor", async () => {
    const { counted } = await seedMixed();

    await setCursor(`user:${anId}`, counted);
    expect((await queries.countGroupUnread(asAn())).total).toBe(1);
  });

  it("counts for a super admin only messages after the account existed", async () => {
    const ids: number[] = [];

    for (let i = 0; i < 4; i += 1) {
      ids.push(await seedMessage(db, groupId, `user:${anId}`, `m${i}`));
    }
    const rows = await db.select().from(chatGroupMessages);
    // Account created exactly when the third message was written.
    const lateAdmin = await seedAdmin(
      db,
      "Late",
      "super_admin",
      rows.find((row) => row.id === ids[2])!.createdAt,
    );

    expect((await queries.countGroupUnread(asSuper())).total).toBe(4);
    expect(
      (
        await queries.countGroupUnread(
          access.sessionOfAdmin({ id: lateAdmin, role: "super_admin" }),
        )
      ).total,
    ).toBe(2);
  });

  it("is not changed by muting", async () => {
    await seedMixed();
    await db
      .update(chatGroupMembers)
      .set({ mutedAt: new Date() })
      .where(eq(chatGroupMembers.memberKey, `user:${anId}`));
    expect((await queries.countGroupUnread(asAn())).total).toBe(2);
  });

  it("is zero for a group the person is not in or has left", async () => {
    await seedMixed();
    const stranger = await seedUser(db, "Stranger");

    expect(
      (await queries.countGroupUnread(access.sessionOfUser({ id: stranger })))
        .total,
    ).toBe(0);
    await db
      .update(chatGroupMembers)
      .set({ leftAt: new Date() })
      .where(eq(chatGroupMembers.memberKey, `user:${anId}`));
    expect((await queries.countGroupUnread(asAn())).total).toBe(0);
  });
});

describe("the inbox list", () => {
  it("lists a trainee's own groups only, newest first, with unread, mute and the preview", async () => {
    const second = await seedGroup(db, {
      createdByKey: `admin:${ptId}`,
      name: "Nhóm hai",
      members: [`user:${anId}`],
    });
    const hiddenFromAn = await seedGroup(db, {
      createdByKey: `admin:${ptId}`,
      name: "Không có An",
      members: [`user:${binhId}`],
    });
    const dissolved = await seedGroup(db, {
      createdByKey: `admin:${ptId}`,
      members: [`user:${anId}`],
      dissolved: true,
    });

    await seedMessage(db, groupId, `admin:${ptId}`, "tin cũ");
    await seedMessage(db, second, `admin:${ptId}`, "tin mới nhất");
    await db
      .update(chatGroupMembers)
      .set({ mutedAt: new Date() })
      .where(eq(chatGroupMembers.groupId, second));
    const list = await queries.listGroupsForSession(asAn());

    expect(list.map((g) => g.id)).toEqual([second, groupId]);
    expect(list.map((g) => g.id)).not.toContain(hiddenFromAn);
    expect(list.map((g) => g.id)).not.toContain(dissolved);
    expect(list[0]).toMatchObject({
      name: "Nhóm hai",
      unread: 1,
      muted: true,
      canManage: false,
      lastMessage: { preview: "tin mới nhất" },
    });
    expect(list[1]).toMatchObject({ muted: false, unread: 1 });
  });

  it("shows a super admin every non-dissolved group, with manage rights", async () => {
    await seedGroup(db, { createdByKey: `admin:${ptId}`, dissolved: true });
    const list = await queries.listGroupsForSession(asSuper());

    expect(list.map((g) => g.id)).toEqual([groupId]);
    expect(list[0].canManage).toBe(true);
    expect(
      (await queries.listGroupsForSession(asPt())).map((g) => g.canManage),
    ).toEqual([true]);
  });

  it("never lets an alert become the preview of a group", async () => {
    await seedMessage(db, groupId, `user:${anId}`, "visible");
    await seedMessage(db, groupId, null, "", {
      audience: "super_admin",
      systemEvent: "{}",
    });
    const list = await queries.listGroupsForSession(asAn());

    expect(list[0].lastMessage?.preview).toBe("visible");
  });

  it("gives no text for an unsent or hidden last message", async () => {
    await seedMessage(db, groupId, `user:${anId}`, "secret", {
      hiddenAt: new Date(),
    });
    const [group] = await queries.listGroupsForSession(asBinh());

    expect(group.lastMessage?.preview).toBe("");
  });
});

describe("members and seen-by", () => {
  it("lists explicit members plus every super admin, never a left member", async () => {
    await db
      .update(chatGroupMembers)
      .set({ leftAt: new Date() })
      .where(eq(chatGroupMembers.memberKey, `user:${binhId}`));
    const second = await seedAdmin(db, "Boss2", null);
    const [group] = await db.select().from(chatGroups);
    const members = await queries.listGroupMembers(
      group,
      await actorOf(asAn()),
    );

    expect(members.map((m) => [m.key, m.role, m.isCreator]).sort()).toEqual(
      [
        [`admin:${superId}`, "super_admin", false],
        [`admin:${second}`, "super_admin", false],
        [`admin:${ptId}`, "pt", true],
        [`user:${anId}`, "trainee", false],
      ].sort(),
    );
  });

  it("does not count a super admin's state row against the explicit members", async () => {
    await db.insert(chatGroupMembers).values({
      groupId,
      memberKey: `admin:${superId}`,
      addedByKey: `admin:${superId}`,
      joinedAt: new Date(),
    });

    expect(await queries.countExplicitMembers(groupId)).toBe(3);
  });

  it("lists who read up to a message, never its sender, and ignores left members", async () => {
    const id = await seedMessage(db, groupId, `user:${anId}`, "hi");

    await setCursor(`user:${anId}`, id);
    await setCursor(`user:${binhId}`, id);
    await setCursor(`admin:${ptId}`, id - 1);
    const seen = await queries.listSeenBy(groupId, id, await actorOf(asAn()));

    expect(seen?.map((m) => m.name)).toEqual(["Binh"]);
    expect(
      (await queries.findGroupMessageView(groupId, id, await actorOf(asAn())))
        ?.seenCount,
    ).toBe(1);
    await db
      .update(chatGroupMembers)
      .set({ leftAt: new Date() })
      .where(eq(chatGroupMembers.memberKey, `user:${binhId}`));
    expect(
      (await queries.listSeenBy(groupId, id, await actorOf(asAn())))?.length,
    ).toBe(0);
  });

  it("answers null for a system line or an alert", async () => {
    const line = await seedMessage(db, groupId, null, "");
    const alert = await seedMessage(db, groupId, null, "", {
      audience: "super_admin",
    });
    const actor = await actorOf(asSuper());

    expect(await queries.listSeenBy(groupId, line, actor)).toBeNull();
    expect(await queries.listSeenBy(groupId, alert, actor)).toBeNull();
    expect(await queries.listSeenBy(groupId, 9999, actor)).toBeNull();
  });
});
