import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createTestDb, type TestDb } from "@/db/__tests__/create-test-db";
import {
  chatGroupMessageEdits,
  chatGroupMessages,
  chatGroupPhotos,
  chatGroupReactions,
  chatGroups,
  userRestrictions,
} from "@/db/schema";
import {
  seedAdmin,
  seedGroup,
  seedMessage,
  seedUser,
} from "@/features/chat-groups/services/__tests__/seed";
import type { GroupSession } from "@/features/chat-groups/types/group";

const state = vi.hoisted(() => ({ db: null as unknown }));

vi.mock("server-only", () => ({}));
vi.mock("@/db", () => ({
  db: new Proxy(
    {},
    { get: (_target, property) => Reflect.get(state.db as object, property) },
  ),
}));

const access = await import("@/features/chat-groups/services/group-access");
const mutations =
  await import("@/features/chat-groups/services/group-mutations");

let db: TestDb;
let superId: number;
let ptId: number;
let otherPtId: number;
let anId: number;
let binhId: number;
let groupId: number;
let message: number;

const context = async (session: GroupSession, id = groupId) =>
  (await access.loadGroupActor(id, session))!;
const asSuper = () =>
  access.sessionOfAdmin({ id: superId, role: "super_admin" });
const asCreator = () => access.sessionOfAdmin({ id: ptId, role: "pt" });
const asOtherPt = () => access.sessionOfAdmin({ id: otherPtId, role: "pt" });
const asAn = () => access.sessionOfUser({ id: anId });
const asBinh = () => access.sessionOfUser({ id: binhId });
const an = { id: 0, chatEnabled: true as boolean | null };
const binh = { id: 0, chatEnabled: true as boolean | null };

beforeEach(async () => {
  db = await createTestDb();
  state.db = db;
  superId = await seedAdmin(db, "Boss", "super_admin");
  ptId = await seedAdmin(db, "Coach", "pt");
  otherPtId = await seedAdmin(db, "Other", "pt");
  anId = await seedUser(db, "An");
  binhId = await seedUser(db, "Binh");
  an.id = anId;
  binh.id = binhId;
  groupId = await seedGroup(db, {
    createdByKey: `admin:${ptId}`,
    members: [
      `admin:${ptId}`,
      `admin:${otherPtId}`,
      `user:${anId}`,
      `user:${binhId}`,
    ],
  });
  message = await seedMessage(db, groupId, `user:${anId}`, "Hôm nay tập chân");
});

describe("reactToGroupMessage", () => {
  it("adds, replaces and removes one reaction per reactor", async () => {
    const ctx = await context(asBinh());
    const react = (emoji: string | null) =>
      mutations.reactToGroupMessage(ctx, binh, {
        groupId,
        messageId: message,
        emoji,
      });

    const added = await react("💪");

    expect(added).toMatchObject({
      status: "success",
      message: { reactions: [{ emoji: "💪", count: 1, mine: true }] },
    });
    const replaced = await react("👍");

    expect(replaced).toMatchObject({
      message: { reactions: [{ emoji: "👍", count: 1, mine: true }] },
    });
    expect(await db.select().from(chatGroupReactions)).toHaveLength(1);
    // The same emoji again, then null, both leave none.
    await react("👍");
    expect(await db.select().from(chatGroupReactions)).toHaveLength(0);
    expect(await react(null)).toMatchObject({
      status: "success",
      message: { reactions: [] },
    });
  });

  it("counts reactions of several members and marks only the viewer's own", async () => {
    await mutations.reactToGroupMessage(await context(asBinh()), binh, {
      groupId,
      messageId: message,
      emoji: "❤️",
    });
    const result = await mutations.reactToGroupMessage(
      await context(asCreator()),
      null,
      { groupId, messageId: message, emoji: "❤️" },
    );

    expect(result).toMatchObject({
      message: { reactions: [{ emoji: "❤️", count: 2, mine: true }] },
    });
  });

  it("stamps the change cursor so pollers see it", async () => {
    await mutations.reactToGroupMessage(await context(asBinh()), binh, {
      groupId,
      messageId: message,
      emoji: "😂",
    });
    const [row] = await db
      .select()
      .from(chatGroupMessages)
      .where(eq(chatGroupMessages.id, message));
    const [group] = await db.select().from(chatGroups);

    expect(row.updatedAt).not.toBeNull();
    expect(group.lastChangeAt?.getTime()).toBe(row.updatedAt?.getTime());
  });

  it("refuses an unsent message, a system line, a foreign message and a bad emoji", async () => {
    const unsent = await seedMessage(db, groupId, `user:${anId}`, "", {
      deletedAt: new Date(),
    });
    const line = await seedMessage(db, groupId, null, "");
    const otherGroup = await seedGroup(db, {
      createdByKey: `admin:${ptId}`,
      members: [`user:${binhId}`],
    });
    const foreign = await seedMessage(db, otherGroup, `user:${binhId}`, "x");
    const ctx = await context(asBinh());
    const react = (messageId: number, emoji: string | null = "💪") =>
      mutations.reactToGroupMessage(ctx, binh, { groupId, messageId, emoji });

    expect(await react(unsent)).toMatchObject({
      status: "error",
      message: "Tin nhắn đã bị thu hồi",
    });
    expect(await react(line)).toMatchObject({
      status: "error",
      message: "Không tìm thấy tin nhắn",
    });
    expect(await react(foreign)).toMatchObject({
      status: "error",
      message: "Không tìm thấy tin nhắn",
    });
    expect(await react(message, "🤡")).toMatchObject({ status: "error" });
    expect(await db.select().from(chatGroupReactions)).toHaveLength(0);
  });

  it("is still allowed under managers-only but not for a restricted trainee", async () => {
    await db.update(chatGroups).set({ managersOnly: true });
    const ctx = await context(asBinh());
    const input = { groupId, messageId: message, emoji: "💪" };

    expect(await mutations.reactToGroupMessage(ctx, binh, input)).toMatchObject(
      { status: "success" },
    );
    await db.insert(userRestrictions).values({
      userId: binhId,
      level: "restricted",
      createdByAdminId: superId,
      createdAt: new Date(),
    });
    expect(
      await mutations.reactToGroupMessage(ctx, binh, { ...input, emoji: "👍" }),
    ).toMatchObject({ status: "error" });
  });
});

describe("editGroupMessage", () => {
  const edit = async (
    session: GroupSession,
    user: typeof an | null,
    body: string,
  ) =>
    mutations.editGroupMessage(await context(session), user, {
      groupId,
      messageId: message,
      body,
    });

  it("stores the previous body and marks the message edited", async () => {
    const result = await edit(asAn(), an, "Hôm nay tập tay");

    expect(result).toMatchObject({
      status: "success",
      message: { body: "Hôm nay tập tay", edited: true },
    });
    expect(
      (await db.select().from(chatGroupMessageEdits)).map((r) => [
        r.messageId,
        r.previousBody,
      ]),
    ).toEqual([[message, "Hôm nay tập chân"]]);
  });

  it("treats saving the same text as no edit", async () => {
    const result = await edit(asAn(), an, "Hôm nay tập chân");

    expect(result).toMatchObject({ message: { edited: false } });
    expect(await db.select().from(chatGroupMessageEdits)).toHaveLength(0);
  });

  it("lets only the author edit, even a manager is refused", async () => {
    for (const [session, user] of [
      [asBinh(), binh],
      [asCreator(), null],
      [asSuper(), null],
    ] as const) {
      expect(await edit(session, user, "Sửa hộ")).toEqual({
        status: "error",
        message: "Bạn chỉ thao tác được trên tin nhắn của mình",
      });
    }
    expect(await db.select().from(chatGroupMessageEdits)).toHaveLength(0);
  });

  it("refuses a sticker, an unsent message and an empty body", async () => {
    const sticker = await seedMessage(db, groupId, `user:${anId}`, "", {
      stickerRef: "pack:fire",
      stickerUrl: "/s.svg",
    });
    const ctx = await context(asAn());

    expect(
      await mutations.editGroupMessage(ctx, an, {
        groupId,
        messageId: sticker,
        body: "x",
      }),
    ).toEqual({ status: "error", message: "Không sửa được sticker" });
    expect(await edit(asAn(), an, "   ")).toMatchObject({ status: "error" });
    await mutations.unsendGroupMessage(ctx, an, {
      groupId,
      messageId: message,
    });
    expect(await edit(asAn(), an, "muộn rồi")).toEqual({
      status: "error",
      message: "Tin nhắn đã bị thu hồi",
    });
  });

  it("is read by the history query for members and not for outsiders", async () => {
    await edit(asAn(), an, "Hôm nay tập tay");
    const queries =
      await import("@/features/chat-groups/services/group-queries");
    const history = await queries.loadGroupEditHistory(
      groupId,
      message,
      (await context(asBinh())).actor,
    );

    expect(history?.map((row) => row.previousBody)).toEqual([
      "Hôm nay tập chân",
    ]);
    expect(
      await queries.loadGroupEditHistory(
        groupId + 1,
        message,
        (await context(asBinh())).actor,
      ),
    ).toBeNull();
  });
});

describe("unsendGroupMessage", () => {
  const unsend = async (session: GroupSession, user: typeof an | null) =>
    mutations.unsendGroupMessage(await context(session), user, {
      groupId,
      messageId: message,
    });

  it("drops the text and the photo bytes, and is idempotent", async () => {
    const [photo] = await db
      .insert(chatGroupPhotos)
      .values({
        groupId,
        messageId: message,
        uploaderKey: `user:${anId}`,
        mime: "image/webp",
        width: 1,
        height: 1,
        data: Buffer.from([1, 2, 3]),
        size: 3,
        createdAt: new Date(),
      })
      .returning({ id: chatGroupPhotos.id });

    await db
      .update(chatGroupMessages)
      .set({ photoId: photo.id })
      .where(eq(chatGroupMessages.id, message));
    const result = await unsend(asAn(), an);

    expect(result).toMatchObject({
      status: "success",
      message: { deleted: true, body: "", photoId: null },
    });
    const [row] = await db
      .select()
      .from(chatGroupMessages)
      .where(eq(chatGroupMessages.id, message));

    expect(row.body).toBe("");
    expect(row.deletedAt).not.toBeNull();
    expect(await db.select().from(chatGroupPhotos)).toHaveLength(0);
    expect(await unsend(asAn(), an)).toMatchObject({ status: "success" });
  });

  it("refuses everyone but the author", async () => {
    for (const [session, user] of [
      [asBinh(), binh],
      [asCreator(), null],
    ] as const) {
      expect(await unsend(session, user)).toEqual({
        status: "error",
        message: "Bạn chỉ thao tác được trên tin nhắn của mình",
      });
    }
  });

  it("lets a restricted trainee take their message back", async () => {
    await db.insert(userRestrictions).values({
      userId: anId,
      level: "restricted",
      createdByAdminId: superId,
      createdAt: new Date(),
    });
    expect(await unsend(asAn(), an)).toMatchObject({ status: "success" });
  });
});

describe("hideGroupMessage", () => {
  const hide = async (
    session: GroupSession,
    user: typeof an | null,
    hidden: boolean,
  ) =>
    mutations.hideGroupMessage(await context(session), user, {
      groupId,
      messageId: message,
      hidden,
    });

  it.each([
    ["a super admin", asSuper],
    ["the creator PT", asCreator],
  ])("lets %s hide and unhide anyone's message", async (_name, session) => {
    const hidden = await hide(session(), null, true);

    expect(hidden).toMatchObject({
      status: "success",
      message: { hidden: true, body: "" },
    });
    const [row] = await db
      .select()
      .from(chatGroupMessages)
      .where(eq(chatGroupMessages.id, message));

    // The text stays stored for moderation.
    expect(row.body).toBe("Hôm nay tập chân");
    expect(row.hiddenAt).not.toBeNull();
    expect(await hide(session(), null, false)).toMatchObject({
      message: { hidden: false, body: "Hôm nay tập chân" },
    });
  });

  it("refuses a PT member who is not the creator and trainees", async () => {
    for (const [session, user] of [
      [asOtherPt(), null],
      [asBinh(), binh],
      [asAn(), an],
    ] as const) {
      expect(await hide(session, user, true)).toEqual({
        status: "error",
        message: "Bạn không quản lý được nhóm này",
      });
    }
    const [row] = await db
      .select()
      .from(chatGroupMessages)
      .where(eq(chatGroupMessages.id, message));

    expect(row.hiddenAt).toBeNull();
  });

  it("shows members a placeholder (no text, sticker or photo) and keeps the author's view the same", async () => {
    await hide(asCreator(), null, true);
    const queries =
      await import("@/features/chat-groups/services/group-queries");
    const forAuthor = await queries.findGroupMessageView(
      groupId,
      message,
      (await context(asAn())).actor,
    );

    expect(forAuthor).toMatchObject({ hidden: true, body: "", photoId: null });
  });

  it("does not bump the cursor again for a repeated hide", async () => {
    await hide(asSuper(), null, true);
    const [first] = await db.select().from(chatGroups);

    await hide(asSuper(), null, true);
    const [second] = await db.select().from(chatGroups);

    expect(second.lastChangeAt?.getTime()).toBe(first.lastChangeAt?.getTime());
  });

  it("cannot hide a system line", async () => {
    const line = await seedMessage(db, groupId, null, "");

    expect(
      await mutations.hideGroupMessage(await context(asSuper()), null, {
        groupId,
        messageId: line,
        hidden: true,
      }),
    ).toMatchObject({ status: "error", message: "Không tìm thấy tin nhắn" });
  });
});
