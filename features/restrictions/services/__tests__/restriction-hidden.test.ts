import { beforeEach, describe, expect, it, vi } from "vitest";

import { createTestDb, type TestDb } from "@/db/__tests__/create-test-db";
import { socialFriendships, socialPosts, users } from "@/db/schema";
import { TERMS_VERSION } from "@/features/social/constants/social";

const state = vi.hoisted(() => ({ db: null as unknown }));

vi.mock("server-only", () => ({}));
vi.mock("@/services/admin-lock", () => ({
  canSeeHiddenUsers: vi.fn(async () => false),
}));
vi.mock("@/db", () => ({
  db: new Proxy(
    {},
    { get: (_target, property) => Reflect.get(state.db as object, property) },
  ),
}));

const friendQueries = await import("@/features/social/services/friend-queries");
const relationships = await import("@/features/social/services/relationships");
const postQueries = await import("@/features/social/services/post-queries");
const { applyRestriction, liftRestriction } =
  await import("@/features/restrictions/services/restriction-mutations");

let db: TestDb;
let alice: number;
let bob: number;
let carol: number;

const addUser = async (name: string) => {
  const [row] = await db
    .insert(users)
    .values({
      name,
      nameKey: name.toLowerCase(),
      email: `${name.toLowerCase()}@example.com`,
      emailKey: `${name.toLowerCase()}@example.com`,
      termsVersion: TERMS_VERSION,
    })
    .returning({ id: users.id });

  return row.id;
};

const befriend = (a: number, b: number) =>
  db.insert(socialFriendships).values({
    userLow: Math.min(a, b),
    userHigh: Math.max(a, b),
    status: "accepted",
    requestedBy: a,
    createdAt: new Date(),
    acceptedAt: new Date(),
  });

const addPost = (authorId: number, caption: string) =>
  db.insert(socialPosts).values({
    authorKind: "user",
    authorId,
    caption,
    privacy: "everyone",
    createdAt: new Date(),
    updatedAt: new Date(),
  });

const suspend = (userId: number) =>
  applyRestriction(1, {
    userId,
    level: "suspended",
    duration: "permanent",
    reason: "abuse",
  });

beforeEach(async () => {
  db = await createTestDb();
  state.db = db;
  alice = await addUser("Alice");
  bob = await addUser("Bob");
  carol = await addUser("Carol");
  await befriend(alice, bob);
  await befriend(alice, carol);
  await addPost(bob, "bob post");
  await addPost(carol, "carol post");
});

const feedCaptions = async () =>
  (await postQueries.listUserFeed(alice)).posts.map((post) => post.caption);

describe("a suspended trainee is hidden from others", () => {
  it("shows everyone until a suspension starts", async () => {
    expect((await friendQueries.listFriends(alice)).map((p) => p.id)).toEqual(
      expect.arrayContaining([bob, carol]),
    );
    expect((await feedCaptions()).sort()).toEqual(["bob post", "carol post"]);
  });

  it("drops them from friend lists", async () => {
    await suspend(bob);

    expect((await friendQueries.listFriends(alice)).map((p) => p.id)).toEqual([
      carol,
    ]);
    expect(await relationships.listFriendIds(alice)).toEqual([carol]);
  });

  it("drops their posts from the feed of others", async () => {
    await suspend(bob);

    expect(await feedCaptions()).toEqual(["carol post"]);
  });

  it("finds nobody by email search", async () => {
    await suspend(bob);

    expect(
      await friendQueries.searchTraineeByEmail(alice, "bob@example.com"),
    ).toBeNull();
    expect(
      (await friendQueries.searchTraineeByEmail(alice, "carol@example.com"))
        ?.id,
    ).toBe(carol);
  });

  it("hides their pending friend requests", async () => {
    const dan = await addUser("Dan");

    await db.insert(socialFriendships).values({
      userLow: alice,
      userHigh: dan,
      status: "pending",
      requestedBy: dan,
      createdAt: new Date(),
    });
    expect(
      (await friendQueries.listFriendRequests(alice)).received.map((p) => p.id),
    ).toEqual([dan]);

    await suspend(dan);

    expect((await friendQueries.listFriendRequests(alice)).received).toEqual(
      [],
    );
  });

  it("counts as blocked either way, but never against themselves", async () => {
    await suspend(bob);

    expect(await relationships.isBlockedBetween(alice, bob)).toBe(true);
    expect(await relationships.isBlockedBetween(bob, alice)).toBe(true);
    expect(await relationships.isBlockedBetween(alice, carol)).toBe(false);
    expect([...(await relationships.listBlockedBetweenIds(alice))]).toEqual([
      bob,
    ]);
    expect((await relationships.listBlockedBetweenIds(bob)).has(bob)).toBe(
      false,
    );
  });

  it("does not hide a merely restricted trainee", async () => {
    await applyRestriction(1, {
      userId: bob,
      level: "restricted",
      duration: "7d",
      reason: "spam",
    });

    expect(await relationships.isBlockedBetween(alice, bob)).toBe(false);
    expect((await feedCaptions()).sort()).toEqual(["bob post", "carol post"]);
  });

  it("brings them back when the suspension is lifted", async () => {
    await suspend(bob);
    await liftRestriction(1, bob);

    expect((await feedCaptions()).sort()).toEqual(["bob post", "carol post"]);
    expect((await friendQueries.listFriends(alice)).map((p) => p.id)).toEqual(
      expect.arrayContaining([bob, carol]),
    );
  });

  it("deletes no data: the posts and the friendship are still stored", async () => {
    await suspend(bob);

    expect(await db.select().from(socialPosts)).toHaveLength(2);
    expect(await db.select().from(socialFriendships)).toHaveLength(2);
  });
});
