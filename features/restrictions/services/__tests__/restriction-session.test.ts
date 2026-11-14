import { beforeEach, describe, expect, it, vi } from "vitest";

import { INITIAL_FORM_STATE } from "@/constants/form";
import { createTestDb, type TestDb } from "@/db/__tests__/create-test-db";
import { users } from "@/db/schema";

const state = vi.hoisted(() => ({
  db: null as unknown,
  sessionUserId: 0,
  locale: "vi",
}));

vi.mock("server-only", () => ({}));
vi.mock("@/services/logger", () => ({
  logServerError: vi.fn(() => ({ code: "UNKNOWN" })),
}));
vi.mock("next-intl/server", () => ({
  getLocale: vi.fn(async () => state.locale),
}));
vi.mock("@/services/locale-cookie", () => ({
  applyStoredLocale: vi.fn(async () => undefined),
}));
vi.mock("@/services/session", () => ({
  readSession: vi.fn(async () => ({
    role: "user",
    userId: state.sessionUserId,
    iat: Math.floor(Date.now() / 1000),
  })),
  startUserSession: vi.fn(async () => undefined),
  startAdminSession: vi.fn(async () => undefined),
  endSession: vi.fn(async () => undefined),
}));
vi.mock("@/services/admin-lock", () => ({
  isAdminLocked: vi.fn(async () => false),
  clearUnlock: vi.fn(async () => undefined),
}));
vi.mock("@/db", () => ({
  db: new Proxy(
    {},
    { get: (_target, property) => Reflect.get(state.db as object, property) },
  ),
}));

const guard = await import("@/services/auth-guard");
const { loginWithEmailAction } =
  await import("@/features/auth/services/auth-actions");
const session = await import("@/services/session");
const { applyRestriction } =
  await import("@/features/restrictions/services/restriction-mutations");
const { hashPassword } = await import("@/services/password");

let db: TestDb;
let userId: number;

const PASSWORD = "long-enough-1";

const toFormData = (fields: Record<string, string>) => {
  const formData = new FormData();

  for (const [key, value] of Object.entries(fields)) {
    formData.set(key, value);
  }
  return formData;
};

const login = (password = PASSWORD) =>
  loginWithEmailAction(
    INITIAL_FORM_STATE,
    toFormData({ email: "an@example.com", password }),
  ).catch((error: unknown) => error);

const suspend = (duration: "24h" | "permanent", reason = "abuse in chat") =>
  applyRestriction(1, { userId, level: "suspended", duration, reason });

beforeEach(async () => {
  db = await createTestDb();
  state.db = db;
  state.locale = "vi";
  vi.mocked(session.startUserSession).mockClear();
  const [row] = await db
    .insert(users)
    .values({
      name: "An",
      nameKey: "an",
      email: "an@example.com",
      emailKey: "an@example.com",
      passwordHash: await hashPassword(PASSWORD),
    })
    .returning({ id: users.id });

  userId = row.id;
  state.sessionUserId = userId;
});

describe("the session check", () => {
  it("accepts a normal trainee", async () => {
    expect(await guard.getCurrentUser()).toMatchObject({ id: userId });
  });

  it("keeps a restricted trainee signed in", async () => {
    await applyRestriction(1, {
      userId,
      level: "restricted",
      duration: "7d",
      reason: "spam",
    });

    expect(await guard.getCurrentUser()).toMatchObject({ id: userId });
  });

  it("rejects a suspended trainee, so requireUser ends the session", async () => {
    await suspend("permanent");

    expect(await guard.getCurrentUser()).toBeNull();
    expect(await guard.getApiUser()).toBeNull();
    const error = await guard.requireUser().catch((e: unknown) => e);

    expect(error).toMatchObject({
      digest: expect.stringContaining("/session/end"),
    });
  });

  it("lets the trainee back in once the suspension is lifted", async () => {
    await suspend("permanent");
    const { liftRestriction } =
      await import("@/features/restrictions/services/restriction-mutations");

    await liftRestriction(1, userId);

    expect(await guard.getCurrentUser()).toMatchObject({ id: userId });
  });

  it("lets the trainee back in when a timed suspension has run out", async () => {
    const { userRestrictions } = await import("@/db/schema");

    await db.insert(userRestrictions).values({
      userId,
      level: "suspended",
      until: new Date(Date.now() - 1000),
      reason: "old",
      createdByAdminId: 1,
      createdAt: new Date(Date.now() - 86_400_000),
    });

    expect(await guard.getCurrentUser()).toMatchObject({ id: userId });
  });
});

describe("login", () => {
  it("signs a normal trainee in", async () => {
    const result = await login();

    expect(result).toMatchObject({
      digest: expect.stringContaining("REDIRECT"),
    });
    expect(session.startUserSession).toHaveBeenCalledWith(userId);
  });

  it("refuses a suspended trainee and shows the end time and the reason", async () => {
    await suspend("24h");

    const result = await login();

    expect(result).toMatchObject({
      status: "error",
      message: expect.stringMatching(
        /^Tài khoản của bạn đã bị khoá đến \d{2}\/\d{2} \d{2}:\d{2}\. Lý do: abuse in chat$/,
      ),
    });
    expect(session.startUserSession).not.toHaveBeenCalled();
  });

  it("says permanent for a permanent suspension, in the request's language", async () => {
    await suspend("permanent", "repeated abuse");

    expect(await login()).toMatchObject({
      message: "Tài khoản của bạn đã bị khoá vĩnh viễn. Lý do: repeated abuse",
    });
    state.locale = "en";
    expect(await login()).toMatchObject({
      message: "Your account is suspended permanently. Reason: repeated abuse",
    });
    expect(session.startUserSession).not.toHaveBeenCalled();
  });

  it("does not reveal a suspension to a wrong password", async () => {
    await suspend("permanent");

    expect(await login("wrong-password-1")).toMatchObject({
      status: "error",
      message: "Sai email hoặc mật khẩu",
    });
  });

  it("lets a restricted trainee sign in", async () => {
    await applyRestriction(1, {
      userId,
      level: "restricted",
      duration: "24h",
      reason: "spam",
    });

    expect(await login()).toMatchObject({
      digest: expect.stringContaining("REDIRECT"),
    });
    expect(session.startUserSession).toHaveBeenCalledWith(userId);
  });
});
