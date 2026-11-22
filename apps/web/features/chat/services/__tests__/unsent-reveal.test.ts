import { beforeEach, describe, expect, it, vi } from "vitest";

import { CHAT_MESSAGES } from "@/features/chat/constants/messages";
import { PHOTO_ALT } from "@/features/chat/utils/photo-rules";
import type { FakeApi } from "@/services/api/testing";
import { apiRefusal } from "@/services/api/testing";

const state = vi.hoisted(() => ({
  fake: null as FakeApi | null,
  role: "super_admin" as "super_admin" | "pt",
}));
const fake = () => state.fake as FakeApi;

vi.mock("server-only", () => ({}));
vi.mock("@/services/logger", () => ({
  logServerError: vi.fn(() => ({ code: "UNKNOWN" })),
}));
vi.mock("@/services/api/call", async () => {
  const { createFakeApi } = await import("@/services/api/testing");

  state.fake = createFakeApi();
  return { callApi: state.fake.callApi, tryApi: state.fake.tryApi };
});
vi.mock("@/services/auth-guard", () => ({
  requireAdmin: vi.fn(async () => ({ id: 1, role: state.role })),
}));

const { revealUnsentMessageAction } =
  await import("@/features/chat/services/unsent-reveal-actions");
const { toRevealed } = await import("@/features/chat/services/unsent-reveal");

const MESSAGE = {
  id: 7,
  body: "secret",
  sticker: null,
  photo: { url: "/v1/chat/photos/3", width: 10, height: 20, alt: "Ảnh" },
  photos: [{ url: "/v1/chat/photos/3", width: 10, height: 20, alt: "Ảnh" }],
};

beforeEach(() => {
  fake().reset();
  fake().respond = () => ({ message: MESSAGE, unsentAt: "2026-01-01" });
  state.role = "super_admin";
});

describe("revealUnsentMessageAction", () => {
  it("answers forbidden to a PT without calling the API", async () => {
    state.role = "pt";

    expect(await revealUnsentMessageAction("coach", 7)).toEqual({
      status: "error",
      message: CHAT_MESSAGES.FORBIDDEN,
    });
    expect(fake().calls).toEqual([]);
  });

  it("rejects a bad id or a group without its id before any call", async () => {
    const results = [
      await revealUnsentMessageAction("coach", 0),
      await revealUnsentMessageAction("coach", 1.5),
      await revealUnsentMessageAction("other", 7),
      await revealUnsentMessageAction("group", 7),
    ];

    for (const result of results) {
      expect(result).toEqual({
        status: "error",
        message: CHAT_MESSAGES.INVALID_INPUT,
      });
    }
    expect(fake().calls).toEqual([]);
  });

  it("reads the original of a coach chat message and maps photo URLs", async () => {
    expect(await revealUnsentMessageAction("coach", 7)).toEqual({
      status: "success",
      content: {
        body: "secret",
        sticker: null,
        photos: [
          { url: "/api/chat/photos/3", width: 10, height: 20, alt: "Ảnh" },
        ],
      },
    });
    expect(fake().calls).toMatchObject([
      {
        actor: "admin",
        method: "GET",
        path: "/v1/chat/messages/{mid}/original",
        init: { params: { path: { mid: 7 } } },
      },
    ]);
  });

  it("uses the DM route for a DM", async () => {
    await revealUnsentMessageAction("dm", 9);

    expect(fake().calls).toMatchObject([
      {
        path: "/v1/dm/messages/{mid}/original",
        init: { params: { path: { mid: 9 } } },
      },
    ]);
  });

  it("uses the group route with the group id for a group message", async () => {
    await revealUnsentMessageAction("group", 9, 4);

    expect(fake().calls).toMatchObject([
      {
        path: "/v1/chat/groups/{groupId}/messages/{mid}/original",
        init: { params: { path: { groupId: 4, mid: 9 } } },
      },
    ]);
  });

  it("answers not found when the message is live or missing (404)", async () => {
    fake().respond = () => {
      throw apiRefusal(404, "MESSAGE_NOT_FOUND", "nope");
    };

    expect(await revealUnsentMessageAction("coach", 7)).toEqual({
      status: "error",
      message: CHAT_MESSAGES.MESSAGE_NOT_FOUND,
    });
  });
});

describe("toRevealed", () => {
  it("falls back to the cover photo and a missing body", () => {
    expect(
      toRevealed({
        body: null,
        photo: { url: "/api/dm/photos/1", width: 1, height: 2 },
        photos: [],
      }),
    ).toEqual({
      body: "",
      sticker: null,
      photos: [
        { url: "/api/dm/photos/1", width: 1, height: 2, alt: PHOTO_ALT },
      ],
    });
  });
});
