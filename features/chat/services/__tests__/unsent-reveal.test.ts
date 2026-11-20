import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ADMIN_COOKIE } from "@/constants/session";
import { createTestDb, type TestDb } from "@/db/__tests__/create-test-db";
import {
  chatConversations,
  chatGroupMessages,
  chatGroupPhotos,
  chatMessages,
  chatPhotos,
  dmConversations,
  dmMessages,
  dmPhotos,
  users,
} from "@/db/schema";
import { CHAT_MESSAGES } from "@/features/chat/constants/messages";

const state = vi.hoisted(() => ({ db: null as unknown }));

vi.mock("server-only", () => ({}));
vi.mock("@/db", () => ({
  db: new Proxy(
    {},
    { get: (_target, property) => Reflect.get(state.db as object, property) },
  ),
}));
vi.mock("@/services/session", () => ({
  readSession: vi.fn(async (cookie: string) =>
    cookie === ADMIN_COOKIE ? { role: "admin", adminId: 1 } : null,
  ),
}));
vi.mock("@/services/admin-lock", () => ({ isAdminLocked: async () => false }));
vi.mock("@/services/admins", () => ({
  findAdminById: vi.fn(async (id: number) => ({
    id,
    username: "root",
    role: "super_admin",
  })),
}));

const { revealUnsentMessageAction } =
  await import("@/features/chat/services/unsent-reveal-actions");

const PNG = Buffer.from([1, 2, 3, 4]);
const PNG_B64 = PNG.toString("base64");
const NOW = new Date("2026-01-01T00:00:00Z");

let db: TestDb;
let conversationId: number;
let userId: number;

beforeEach(async () => {
  db = await createTestDb();
  state.db = db;
  const [user] = await db
    .insert(users)
    .values({ name: "An", nameKey: "an", chatEnabled: true })
    .returning({ id: users.id });

  userId = user.id;
  const [conversation] = await db
    .insert(chatConversations)
    .values({ userId })
    .returning({ id: chatConversations.id });

  conversationId = conversation.id;
});

const coachMessage = async (n: number, deletedAt: Date | null, body: string) =>
  (
    await db
      .insert(chatMessages)
      .values({
        conversationId,
        senderRole: "user",
        body,
        clientId: `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
        deletedAt,
        createdAt: NOW,
      })
      .returning({ id: chatMessages.id })
  )[0].id;

describe("revealUnsentMessageAction (super admin)", () => {
  it("returns the text, sticker and photos of an unsent coach message", async () => {
    const id = await coachMessage(1, NOW, "đã thu hồi");

    await db
      .update(chatMessages)
      .set({
        stickerRef: "giphy:abc",
        stickerUrl: "https://media.giphy.com/media/abc/giphy.gif",
      })
      .where(eq(chatMessages.id, id));
    await db.insert(chatPhotos).values([
      {
        conversationId,
        messageId: id,
        uploaderKey: "user",
        position: 1,
        mime: "image/webp",
        width: 20,
        height: 10,
        data: PNG,
        size: PNG.length,
        createdAt: NOW,
      },
      {
        conversationId,
        messageId: id,
        uploaderKey: "user",
        position: 0,
        mime: "image/webp",
        width: 30,
        height: 15,
        data: PNG,
        size: PNG.length,
        createdAt: NOW,
      },
    ]);

    const result = await revealUnsentMessageAction("coach", id);

    expect(result.status).toBe("success");
    if (result.status !== "success") {
      return;
    }
    expect(result.content.body).toBe("đã thu hồi");
    expect(result.content.sticker?.kind).toBe("giphy");
    expect(result.content.photos.map((p) => [p.width, p.url])).toEqual([
      [30, `data:image/webp;base64,${PNG_B64}`],
      [20, `data:image/webp;base64,${PNG_B64}`],
    ]);
  });

  it("answers not found for a live coach message and a missing id", async () => {
    const live = await coachMessage(2, null, "vẫn còn");

    expect(await revealUnsentMessageAction("coach", live)).toEqual({
      status: "error",
      message: CHAT_MESSAGES.MESSAGE_NOT_FOUND,
    });
    expect(await revealUnsentMessageAction("coach", 9999)).toEqual({
      status: "error",
      message: CHAT_MESSAGES.MESSAGE_NOT_FOUND,
    });
  });

  it("reveals an unsent DM with its photo and refuses a live one", async () => {
    const [conversation] = await db
      .insert(dmConversations)
      .values({ userLow: userId, userHigh: userId + 1, createdAt: NOW })
      .returning({ id: dmConversations.id });
    const base = {
      conversationId: conversation.id,
      senderId: userId,
      createdAt: NOW,
    };
    const [unsent] = await db
      .insert(dmMessages)
      .values({ ...base, body: "bí mật", clientId: "dm-1", deletedAt: NOW })
      .returning({ id: dmMessages.id });
    const [live] = await db
      .insert(dmMessages)
      .values({ ...base, body: "công khai", clientId: "dm-2" })
      .returning({ id: dmMessages.id });

    await db.insert(dmPhotos).values({
      conversationId: conversation.id,
      messageId: unsent.id,
      uploaderId: userId,
      mime: "image/png",
      width: 8,
      height: 8,
      data: PNG,
      size: PNG.length,
      createdAt: NOW,
    });

    const revealed = await revealUnsentMessageAction("dm", unsent.id);

    expect(revealed).toEqual({
      status: "success",
      content: {
        body: "bí mật",
        sticker: null,
        photos: [
          {
            url: `data:image/png;base64,${PNG_B64}`,
            width: 8,
            height: 8,
            alt: expect.any(String),
          },
        ],
      },
    });
    expect((await revealUnsentMessageAction("dm", live.id)).status).toBe(
      "error",
    );
  });

  it("reveals an unsent group message, but not a live one or a system line", async () => {
    const base = { groupId: 1, createdAt: NOW };
    const [unsent] = await db
      .insert(chatGroupMessages)
      .values({
        ...base,
        kind: "message",
        senderKey: "user:1",
        body: "nhóm bí mật",
        clientId: "g-1",
        deletedAt: NOW,
      })
      .returning({ id: chatGroupMessages.id });
    const [live] = await db
      .insert(chatGroupMessages)
      .values({
        ...base,
        kind: "message",
        senderKey: "user:1",
        body: "còn",
        clientId: "g-2",
      })
      .returning({ id: chatGroupMessages.id });
    const [system] = await db
      .insert(chatGroupMessages)
      .values({ ...base, kind: "system", body: "", deletedAt: NOW })
      .returning({ id: chatGroupMessages.id });

    await db.insert(chatGroupPhotos).values({
      groupId: 1,
      messageId: unsent.id,
      uploaderKey: "user:1",
      mime: "image/jpeg",
      width: 5,
      height: 6,
      data: PNG,
      size: PNG.length,
      createdAt: NOW,
    });

    const revealed = await revealUnsentMessageAction("group", unsent.id);

    expect(revealed.status).toBe("success");
    if (revealed.status === "success") {
      expect(revealed.content.body).toBe("nhóm bí mật");
      expect(revealed.content.photos).toHaveLength(1);
    }
    expect((await revealUnsentMessageAction("group", live.id)).status).toBe(
      "error",
    );
    expect((await revealUnsentMessageAction("group", system.id)).status).toBe(
      "error",
    );
  });

  it("does not look an id up in another chat system's table", async () => {
    const id = await coachMessage(3, NOW, "chỉ ở coach");

    expect((await revealUnsentMessageAction("dm", id)).status).toBe("error");
    expect((await revealUnsentMessageAction("group", id)).status).toBe("error");
  });
});
