import { beforeEach, describe, expect, it, vi } from "vitest";

import { createTestDb, type TestDb } from "@/db/__tests__/create-test-db";
import {
  chatNicknames,
  contactAliases,
  pushSubscriptions,
  users,
} from "@/db/schema";

const state = vi.hoisted(() => ({ db: null as unknown }));

vi.mock("server-only", () => ({}));
vi.mock("web-push", () => ({ default: { sendNotification: vi.fn() } }));
vi.mock("@/db", () => ({
  db: new Proxy(
    {},
    { get: (_target, property) => Reflect.get(state.db as object, property) },
  ),
}));

const push = await import("@/features/chat/services/chat-push");

type Sender = import("@/features/chat/services/chat-push").PushSender;
type Input = Parameters<typeof push.sendReactionPush>[0];

let db: TestDb;
let traineeId: number;

const addSub = (ownerKey: string, name: string) =>
  db.insert(pushSubscriptions).values({
    ownerKey,
    endpoint: `https://push.example/${name}`,
    p256dh: "p",
    auth: "a",
  });

const input = (recipient: Input["recipient"]): Input => ({
  recipient,
  reactorName: "Hoan",
  emoji: "❤️",
  traineeUserId: traineeId,
  conversationId: 3,
});

beforeEach(async () => {
  vi.restoreAllMocks();
  db = await createTestDb();
  state.db = db;
  push.resetChatPushForTests();
  vi.stubEnv("VAPID_PUBLIC_KEY", "pub");
  vi.stubEnv("NEXT_PUBLIC_VAPID_PUBLIC_KEY", "");
  vi.stubEnv("VAPID_PRIVATE_KEY", "priv");
  vi.stubEnv("VAPID_SUBJECT", "mailto:pt@example.com");
  vi.spyOn(console, "error").mockImplementation(() => {});
  const [row] = await db
    .insert(users)
    .values({ name: "Lan", nameKey: "lan" })
    .returning({ id: users.id });

  traineeId = row.id;
});

describe("sendReactionPush", () => {
  it("sends once to the author's devices only, with no message text", async () => {
    await addSub(`user:${traineeId}`, "t1");
    await addSub("admin:1", "a1");
    await addSub("admin:2", "a2");
    const sender = vi.fn<Sender>(async () => undefined);

    await push.sendReactionPush(input({ role: "admin", adminId: 2 }), sender);

    expect(sender).toHaveBeenCalledTimes(1);
    expect(sender.mock.calls[0][0].endpoint).toBe("https://push.example/a2");
    expect(sender.mock.calls[0][1]).toEqual({
      title: "PT App",
      body: "Hoan đã thả ❤️ vào tin nhắn của bạn",
      url: `/admin/users/${traineeId}/messages`,
      tag: "chat-react-3",
    });
  });

  it("links a trainee author to the messages tab", async () => {
    await addSub(`user:${traineeId}`, "t1");
    const sender = vi.fn<Sender>(async () => undefined);

    await push.sendReactionPush(
      input({ role: "user", userId: traineeId }),
      sender,
    );

    expect(sender.mock.calls[0][1].url).toBe("/messages/coach");
  });

  it("names the reactor by the conversation's shared nickname, ignoring aliases of other owners", async () => {
    const nick = (targetKey: string, nickname: string) => ({
      conversationId: 3,
      targetKey,
      nickname,
      setByKey: "user",
      updatedAt: new Date(),
    });

    await db
      .insert(chatNicknames)
      .values([nick("pt", "Thầy"), nick("admin:2", "Sếp"), nick("user", "Na")]);
    // Not the recipient's alias (owner admin:2, recipient is the trainee).
    await db.insert(contactAliases).values({
      ownerKey: "admin:2",
      targetKey: "admin:1",
      alias: "Riêng",
      updatedAt: new Date(),
    });
    await addSub(`user:${traineeId}`, "t1");
    await addSub("admin:3", "a3");
    const sender = vi.fn<Sender>(async () => undefined);
    const body = () => sender.mock.calls.at(-1)?.[1].body;

    // Trainee author, admin reactor: the shared nickname for the PT side.
    await push.sendReactionPush(
      { ...input({ role: "user", userId: traineeId }), reactorKey: "admin:1" },
      sender,
    );
    expect(body()).toBe("Thầy đã thả ❤️ vào tin nhắn của bạn");

    // ... but a nickname for that very admin wins.
    await push.sendReactionPush(
      { ...input({ role: "user", userId: traineeId }), reactorKey: "admin:2" },
      sender,
    );
    expect(body()).toBe("Sếp đã thả ❤️ vào tin nhắn của bạn");

    // Admin author, trainee reactor.
    await push.sendReactionPush(
      { ...input({ role: "admin", adminId: 3 }), reactorKey: "user" },
      sender,
    );
    expect(body()).toBe("Na đã thả ❤️ vào tin nhắn của bạn");
  });

  it("prefers the recipient's private alias for the reactor over shared nicknames", async () => {
    const alias = (ownerKey: string, targetKey: string, value: string) => ({
      ownerKey,
      targetKey,
      alias: value,
      updatedAt: new Date(),
    });

    await db.insert(chatNicknames).values({
      conversationId: 3,
      targetKey: "user",
      nickname: "Na",
      setByKey: "user",
      updatedAt: new Date(),
    });
    await db.insert(contactAliases).values([
      alias("admin:3", `user:${traineeId}`, "Bé Na"),
      // The reactor's own alias for themselves or others never applies.
      alias(`user:${traineeId}`, `user:${traineeId}`, "Tự gọi"),
      alias("admin:4", `user:${traineeId}`, "Của admin 4"),
    ]);
    await addSub("admin:3", "a3");
    await addSub("admin:5", "a5");
    const sender = vi.fn<Sender>(async () => undefined);
    const body = () => sender.mock.calls.at(-1)?.[1].body;

    await push.sendReactionPush(
      { ...input({ role: "admin", adminId: 3 }), reactorKey: "user" },
      sender,
    );
    expect(body()).toBe("Bé Na đã thả ❤️ vào tin nhắn của bạn");

    // Another admin without an alias falls back to the shared nickname.
    await push.sendReactionPush(
      { ...input({ role: "admin", adminId: 5 }), reactorKey: "user" },
      sender,
    );
    expect(body()).toBe("Na đã thả ❤️ vào tin nhắn của bạn");

    // A trainee recipient with an alias for the reacting admin.
    await db
      .insert(contactAliases)
      .values(alias(`user:${traineeId}`, "admin:1", "Anh Hoan"));
    await addSub(`user:${traineeId}`, "t1");
    await push.sendReactionPush(
      { ...input({ role: "user", userId: traineeId }), reactorKey: "admin:1" },
      sender,
    );
    expect(body()).toBe("Anh Hoan đã thả ❤️ vào tin nhắn của bạn");
  });

  it("drops a dead subscription and does not throw", async () => {
    await addSub(`user:${traineeId}`, "gone");

    await push.sendReactionPush(
      input({ role: "user", userId: traineeId }),
      async () => {
        throw Object.assign(new Error("gone"), { statusCode: 410 });
      },
    );

    expect(await db.select().from(pushSubscriptions)).toEqual([]);
  });

  it("sends nothing when the author has no subscription", async () => {
    const sender = vi.fn<Sender>(async () => undefined);

    await push.sendReactionPush(input({ role: "admin", adminId: 9 }), sender);

    expect(sender).not.toHaveBeenCalled();
  });
});
