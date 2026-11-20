import { beforeEach, describe, expect, it, vi } from "vitest";

import { CHAT_MESSAGES } from "@/features/chat/constants/messages";

type Who = "none" | "user" | "pt" | "super_admin";

const state = vi.hoisted(() => ({ who: "none" as Who }));

vi.mock("server-only", () => ({}));
// Any query that slips through the gate hits this and fails loudly.
vi.mock("@/db", () => ({ db: {} }));
vi.mock("@/features/chat/services/unsent-reveal", () => ({
  loadUnsentContent: vi.fn(async () => ({
    body: "secret",
    sticker: null,
    photos: [],
  })),
}));
vi.mock("@/services/session", () => ({ readSession: vi.fn() }));
vi.mock("@/services/admin-lock", () => ({ isAdminLocked: async () => false }));
vi.mock("@/services/admins", () => ({
  findAdminById: vi.fn(async (id: number) => ({
    id,
    username: `admin${id}`,
    role: state.who === "super_admin" ? "super_admin" : "pt",
  })),
}));
vi.mock("@/services/users", () => ({
  findUserById: vi.fn(async (id: number) => ({
    id,
    passwordChangedAt: null,
  })),
}));
vi.mock("@/features/restrictions/services/restriction-queries", () => ({
  getRequestRestriction: vi.fn(async () => null),
}));

const { ADMIN_COOKIE, USER_COOKIE } = await import("@/constants/session");
const session = await import("@/services/session");
const loader = await import("@/features/chat/services/unsent-reveal");
const { revealUnsentMessageAction } =
  await import("@/features/chat/services/unsent-reveal-actions");

beforeEach(() => {
  vi.clearAllMocks();
  state.who = "none";
  vi.mocked(session.readSession).mockImplementation((async (cookie: string) => {
    if (
      cookie === ADMIN_COOKIE &&
      (state.who === "pt" || state.who === "super_admin")
    ) {
      return { role: "admin", adminId: 1 };
    }
    if (cookie === USER_COOKIE && state.who === "user") {
      return { role: "user", userId: 1 };
    }
    return null;
  }) as never);
});

describe("revealUnsentMessageAction role gate", () => {
  it.each<[string, Who]>([
    ["a PT admin", "pt"],
    ["a trainee", "user"],
    ["no session", "none"],
  ])("refuses %s without touching any message query", async (_label, who) => {
    state.who = who;

    const result = await revealUnsentMessageAction("coach", 5);

    expect(result).toEqual({
      status: "error",
      message: CHAT_MESSAGES.FORBIDDEN,
    });
    expect(loader.loadUnsentContent).not.toHaveBeenCalled();
  });

  it("refuses before validating input (a bad id from a PT is still forbidden)", async () => {
    state.who = "pt";

    const result = await revealUnsentMessageAction("nope", -1);

    expect(result).toEqual({
      status: "error",
      message: CHAT_MESSAGES.FORBIDDEN,
    });
    expect(loader.loadUnsentContent).not.toHaveBeenCalled();
  });

  it("lets a super admin through to the loader with the validated input", async () => {
    state.who = "super_admin";

    const result = await revealUnsentMessageAction("group", 7);

    expect(loader.loadUnsentContent).toHaveBeenCalledExactlyOnceWith(
      "group",
      7,
    );
    expect(result).toEqual({
      status: "success",
      content: { body: "secret", sticker: null, photos: [] },
    });
  });

  it("rejects an invalid kind or id from a super admin without querying", async () => {
    state.who = "super_admin";

    const badKind = await revealUnsentMessageAction("nope", 7);
    const badId = await revealUnsentMessageAction("coach", 0);

    expect(badKind.status).toBe("error");
    expect(badId.status).toBe("error");
    expect(loader.loadUnsentContent).not.toHaveBeenCalled();
  });

  it("answers not found when the loader finds no unsent message", async () => {
    state.who = "super_admin";
    vi.mocked(loader.loadUnsentContent).mockResolvedValueOnce(null);

    const result = await revealUnsentMessageAction("dm", 99);

    expect(result).toEqual({
      status: "error",
      message: CHAT_MESSAGES.MESSAGE_NOT_FOUND,
    });
  });
});
