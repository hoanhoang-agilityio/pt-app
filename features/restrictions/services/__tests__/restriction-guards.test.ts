import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createTestDb, type TestDb } from "@/db/__tests__/create-test-db";
import {
  chatMessages,
  chatReactions,
  socialComments,
  socialFriendships,
  socialPosts,
  socialReactions,
  userRestrictions,
  users,
} from "@/db/schema";
import { TERMS_VERSION } from "@/features/social/constants/social";

const state = vi.hoisted(() => ({
  db: null as unknown,
  user: null as unknown,
}));

vi.mock("server-only", () => ({}));
vi.mock("web-push", () => ({ default: { sendNotification: vi.fn() } }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/services/logger", () => ({
  logServerError: vi.fn(() => ({ code: "UNKNOWN" })),
}));
vi.mock("@/services/admin-lock", () => ({
  canSeeHiddenUsers: vi.fn(async () => false),
}));
vi.mock("@/features/chat/services/chat-realtime", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("@/features/chat/services/chat-realtime")
  >()),
  publishNewMessage: vi.fn(async () => undefined),
  publishRead: vi.fn(async () => undefined),
  publishChatStatus: vi.fn(async () => undefined),
  publishMessageUpdate: vi.fn(async () => undefined),
}));
vi.mock("@/features/chat/services/chat-push", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("@/features/chat/services/chat-push")
  >()),
  schedulePush: vi.fn(),
}));
vi.mock("@/features/social/services/dm-notify", () => ({
  publishDmEvent: vi.fn(async () => undefined),
  scheduleDmPush: vi.fn(),
}));
vi.mock("@/services/auth-guard", () => ({
  requireUser: vi.fn(async () => state.user),
  requireAdmin: vi.fn(async () => {
    throw new Error("not an admin test");
  }),
}));
vi.mock("@/db", () => ({
  db: new Proxy(
    {},
    { get: (_target, property) => Reflect.get(state.db as object, property) },
  ),
}));

const chat = await import("@/features/chat/services/chat-actions");
const posts = await import("@/features/social/services/social-actions");
const engagement =
  await import("@/features/social/services/engagement-actions");
const friends = await import("@/features/social/services/friend-actions");
const dms = await import("@/features/social/services/dm-actions");
const { RESTRICTION_MESSAGES } =
  await import("@/features/restrictions/constants/messages");
const mutations =
  await import("@/features/restrictions/services/restriction-mutations");

let db: TestDb;
let alice: number;
let bob: number;

const RESTRICTED = {
  status: "error",
  message: RESTRICTION_MESSAGES.RESTRICTED,
} as const;

const uuid = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

const addUser = async (name: string) => {
  const [row] = await db
    .insert(users)
    .values({
      name,
      nameKey: name.toLowerCase(),
      chatEnabled: true,
      termsVersion: TERMS_VERSION,
    })
    .returning({ id: users.id });

  return row.id;
};

const signInAs = async (id: number) => {
  const [row] = await db.select().from(users).where(eq(users.id, id));

  state.user = row;
};

const block = (
  userId: number,
  level: "restricted" | "suspended" = "restricted",
  duration: "24h" | "permanent" = "24h",
) =>
  mutations.applyRestriction(1, {
    userId,
    level,
    duration,
    reason: "spam",
  });

const addPost = async (authorId: number) => {
  const [row] = await db
    .insert(socialPosts)
    .values({
      authorKind: "user",
      authorId,
      caption: "hello",
      privacy: "everyone",
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning({ id: socialPosts.id });

  return row.id;
};

beforeEach(async () => {
  db = await createTestDb();
  state.db = db;
  alice = await addUser("Alice");
  bob = await addUser("Bob");
  await signInAs(alice);
});

describe("a restricted trainee in chat", () => {
  const send = (n: number, extra: Record<string, unknown> = {}) =>
    chat.sendMessageAction({ body: `hi ${n}`, clientId: uuid(n), ...extra });

  it("cannot send text, a sticker or a photo message", async () => {
    await block(alice);

    expect(await send(1)).toEqual(RESTRICTED);
    expect(
      await chat.sendMessageAction({
        sticker: { pack: "x", id: "y" },
        clientId: uuid(2),
      }),
    ).toEqual(RESTRICTED);
    expect(await send(3, { photoId: 1 })).toEqual(RESTRICTED);
    expect(await db.select().from(chatMessages)).toHaveLength(0);
  });

  it("can send again once the block is lifted", async () => {
    await block(alice);
    await db
      .update(userRestrictions)
      .set({ liftedAt: new Date(), liftedByAdminId: 1 });

    expect((await send(4)).status).toBe("success");
    expect(await db.select().from(chatMessages)).toHaveLength(1);
  });

  it("can send again after a timed block has expired", async () => {
    await db.insert(userRestrictions).values({
      userId: alice,
      level: "restricted",
      until: new Date(Date.now() - 1000),
      reason: "old",
      createdByAdminId: 1,
      createdAt: new Date(Date.now() - 86_400_000),
    });

    expect((await send(5)).status).toBe("success");
  });

  it("cannot react or edit, but can still take a message back", async () => {
    const sent = await send(6);

    expect(sent.status).toBe("success");
    const messageId = (sent as { message: { id: number } }).message.id;

    await block(alice);

    expect(await chat.reactMessageAction({ messageId, emoji: "👍" })).toEqual(
      RESTRICTED,
    );
    expect(
      await chat.editMessageAction({ messageId, body: "changed" }),
    ).toEqual(RESTRICTED);
    expect(await db.select().from(chatReactions)).toHaveLength(0);
    const [row] = await db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.id, messageId));

    expect(row.body).toBe("hi 6");
    expect((await chat.unsendMessageAction({ messageId })).status).toBe(
      "success",
    );
  });

  it("keeps the chat read state working (reading is allowed)", async () => {
    await block(alice);

    expect((await chat.markReadAction({ lastReadMessageId: 0 })).status).toBe(
      "success",
    );
  });

  it("leaves another trainee's chat alone", async () => {
    await block(alice);
    await signInAs(bob);

    expect((await send(7)).status).toBe("success");
  });
});

describe("a restricted trainee in the social feed", () => {
  it("cannot create or edit a post or the bio, but can delete their own", async () => {
    const own = await addPost(alice);

    await block(alice);

    expect(
      await posts.createPostAction("user", {
        caption: "new",
        privacy: "everyone",
        photoId: null,
      }),
    ).toEqual(RESTRICTED);
    expect(
      await posts.editPostAction("user", {
        postId: own,
        caption: "edited",
        privacy: "everyone",
      }),
    ).toEqual(RESTRICTED);
    expect(await posts.updateBioAction("user", "bio")).toEqual(RESTRICTED);
    const rows = await db.select().from(socialPosts);

    expect(rows).toHaveLength(1);
    expect(rows[0].caption).toBe("hello");
    expect((await posts.deletePostAction("user", own)).status).toBe("success");
    const [deleted] = await db.select().from(socialPosts);

    expect(deleted.deletedAt).not.toBeNull();
  });

  it("cannot comment, edit a comment or react to a post", async () => {
    const post = await addPost(bob);

    await block(alice);

    expect(
      await engagement.addCommentAction("user", { postId: post, body: "hey" }),
    ).toEqual(RESTRICTED);
    expect(
      await engagement.editCommentAction("user", { commentId: 1, body: "x" }),
    ).toEqual(RESTRICTED);
    expect(
      await engagement.reactAction("user", { postId: post, emoji: "👍" }),
    ).toEqual(RESTRICTED);
    expect(await db.select().from(socialComments)).toHaveLength(0);
    expect(await db.select().from(socialReactions)).toHaveLength(0);
  });

  it("can comment and react as soon as the block is lifted", async () => {
    const post = await addPost(bob);

    await block(alice);
    await db.update(userRestrictions).set({ liftedAt: new Date() });

    expect(
      (
        await engagement.addCommentAction("user", {
          postId: post,
          body: "hey",
        })
      ).status,
    ).toBe("success");
    expect(
      (await engagement.reactAction("user", { postId: post, emoji: "👍" }))
        .status,
    ).toBe("success");
  });

  it("cannot send or accept a friend request, but can decline one", async () => {
    await db.insert(socialFriendships).values({
      userLow: alice,
      userHigh: bob,
      status: "pending",
      requestedBy: bob,
      createdAt: new Date(),
    });
    await block(alice);

    expect(await friends.sendFriendRequestAction(bob)).toEqual(RESTRICTED);
    expect(await friends.acceptFriendRequestAction(bob)).toEqual(RESTRICTED);
    expect((await db.select().from(socialFriendships))[0].status).toBe(
      "pending",
    );
    expect((await friends.declineFriendRequestAction(bob)).status).toBe(
      "success",
    );
  });

  it("cannot send a direct message", async () => {
    await block(alice);

    expect(
      await dms.sendDmAction({
        conversationId: 1,
        clientId: uuid(9),
        body: "hi",
      }),
    ).toEqual(RESTRICTED);
  });
});
